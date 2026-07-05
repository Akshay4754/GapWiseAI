const { randomUUID } = require("crypto");
const { GoogleGenAI } = require("@google/genai");
const pdfParse = require("pdf-parse");

let langChainModulesPromise;
let pineconeClient;
let embeddingsClient;

class GoogleEmbeddingClient {
  constructor() {
    const googleApiKey = process.env.GOOGLE_GENAI_API_KEY?.trim();

    if (!googleApiKey) {
      const error = new Error(
        "GOOGLE_GENAI_API_KEY is missing. Add it to Backend/.env and restart the backend.",
      );
      error.code = "MISSING_AI_API_KEY";
      error.status = 500;
      throw error;
    }

    this.client = new GoogleGenAI({ apiKey: googleApiKey });
    this.model =
      process.env.GOOGLE_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
    this.outputDimensionality = Number(
      process.env.GOOGLE_EMBEDDING_DIMENSIONS || 768,
    );
  }

  extractValues(response) {
    const values = response?.embeddings?.[0]?.values || response?.embedding?.values;

    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `Embedding generation returned no values for model ${this.model}.`,
      );
    }

    return values;
  }

  async embedQuery(text) {
    const response = await this.client.models.embedContent({
      model: this.model,
      contents: text,
      config: {
        outputDimensionality: this.outputDimensionality,
      },
    });

    return this.extractValues(response);
  }

  async embedDocuments(texts) {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }
}

function assertRagConfiguration() {
  const pineconeApiKey = process.env.PINECONE_API_KEY?.trim();
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME?.trim();
  const googleApiKey = process.env.GOOGLE_GENAI_API_KEY?.trim();

  if (!googleApiKey) {
    const error = new Error(
      "GOOGLE_GENAI_API_KEY is missing. Add it to Backend/.env and restart the backend.",
    );
    error.code = "MISSING_AI_API_KEY";
    error.status = 500;
    throw error;
  }

  if (!pineconeApiKey || !pineconeIndexName) {
    const error = new Error(
      "PINECONE_API_KEY and PINECONE_INDEX_NAME are required for RAG retrieval.",
    );
    error.code = "MISSING_PINECONE_CONFIG";
    error.status = 500;
    throw error;
  }

  return {
    pineconeApiKey,
    pineconeIndexName,
    googleApiKey,
  };
}

async function loadLangChainModules() {
  if (!langChainModulesPromise) {
    langChainModulesPromise = Promise.all([
      import("langchain/text_splitter"),
      import("@pinecone-database/pinecone"),
      import("@langchain/pinecone"),
    ]).then(
      ([
        textSplitterModule,
        pineconeModule,
        pineconeStoreModule,
      ]) => ({
        RecursiveCharacterTextSplitter:
          textSplitterModule.RecursiveCharacterTextSplitter,
        Pinecone: pineconeModule.Pinecone,
        PineconeStore: pineconeStoreModule.PineconeStore,
      }),
    );
  }

  return langChainModulesPromise;
}

async function getEmbeddingsClient() {
  if (!embeddingsClient) {
    assertRagConfiguration();
    embeddingsClient = new GoogleEmbeddingClient();
  }

  return embeddingsClient;
}

async function getPineconeIndex() {
  if (!pineconeClient) {
    const { Pinecone } = await loadLangChainModules();
    const { pineconeApiKey, pineconeIndexName } = assertRagConfiguration();

    pineconeClient = new Pinecone({ apiKey: pineconeApiKey });
    pineconeClient.__indexName = pineconeIndexName;
  }

  return pineconeClient.index(pineconeClient.__indexName);
}

async function extractPdfTextFromBuffer(buffer) {
  if (pdfParse?.PDFParse) {
    const result = await new pdfParse.PDFParse(
      Uint8Array.from(buffer),
    ).getText();
    return result?.text?.trim() || "";
  }

  const result = await pdfParse(buffer);
  return result?.text?.trim() || "";
}

async function splitTextIntoDocuments(text, metadata = {}) {
  if (!text || !text.trim()) {
    return [];
  }

  const { RecursiveCharacterTextSplitter } = await loadLangChainModules();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: Number(process.env.RAG_CHUNK_SIZE || 1000),
    chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP || 200),
  });

  return splitter.createDocuments([text], [metadata]);
}

async function indexTextDocument({ text, metadata = {} }) {
  const documents = await splitTextIntoDocuments(text, metadata);

  if (documents.length === 0) {
    return {
      count: 0,
      documents: [],
      sourceId: metadata.sourceId || randomUUID(),
    };
  }

  const { PineconeStore } = await loadLangChainModules();
  const embeddings = await getEmbeddingsClient();
  const pineconeIndex = await getPineconeIndex();

  await PineconeStore.fromDocuments(documents, embeddings, {
    pineconeIndex,
  });

  return {
    count: documents.length,
    documents,
    sourceId: metadata.sourceId || randomUUID(),
  };
}

async function retrieveRelevantChunks({ query, filter = {}, topK = 5 }) {
  if (!query || !query.trim()) {
    return [];
  }

  const { PineconeStore } = await loadLangChainModules();
  const embeddings = await getEmbeddingsClient();
  const pineconeIndex = await getPineconeIndex();

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
  });

  return vectorStore.similaritySearch(query, topK, filter);
}

function formatRetrievedChunks(chunks = []) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return "";
  }

  return chunks
    .map((chunk, index) => {
      const fileName =
        chunk.metadata?.fileName ||
        chunk.metadata?.sourceName ||
        "Uploaded document";
      const chunkLabel = `Chunk ${index + 1}`;
      return `[${chunkLabel} | ${fileName}]\n${chunk.pageContent.trim()}`;
    })
    .join("\n---\n");
}

async function initializeResumeCollection(userId, resumeText, options = {}) {
  const sourceId = options.sourceId || `resume-${userId}-${randomUUID()}`;

  return indexTextDocument({
    text: resumeText,
    metadata: {
      userId,
      sourceId,
      docType: options.docType || "resume",
      fileName: options.fileName || "resume.pdf",
    },
  });
}

async function retrieveRelevantResumeChunks(
  userId,
  query,
  topK = 5,
  options = {},
) {
  return retrieveRelevantChunks({
    query,
    topK,
    filter: {
      userId,
      sourceId: options.sourceId,
      docType: options.docType || "resume",
    },
  });
}

async function retrieveRelevantPdfChunks(
  userId,
  query,
  topK = 5,
  options = {},
) {
  return retrieveRelevantChunks({
    query,
    topK,
    filter: {
      userId,
      sourceId: options.sourceId,
      docType: options.docType || "pdf-qa",
    },
  });
}

async function cleanupUserCollection() {
  return true;
}

module.exports = {
  assertRagConfiguration,
  extractPdfTextFromBuffer,
  formatRetrievedChunks,
  initializeResumeCollection,
  indexTextDocument,
  retrieveRelevantChunks,
  retrieveRelevantPdfChunks,
  retrieveRelevantResumeChunks,
  cleanupUserCollection,
  splitTextIntoDocuments,
};
