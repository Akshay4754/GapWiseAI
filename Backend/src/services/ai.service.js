const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer-core")
const chromium = require("@sparticuz/chromium")

const createMissingApiKeyError = () => {
    const error = new Error("GOOGLE_GENAI_API_KEY is missing. Add it to Backend/.env and restart the backend.")
    error.code = "MISSING_AI_API_KEY"
    error.status = 500
    return error
}

const getAiClient = () => {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY?.trim()
    if (!apiKey) {
        throw createMissingApiKeyError()
    }

    return new GoogleGenAI({ apiKey })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isTransientAiError = (error) => {
    const status = error?.status || error?.error?.code
    return status === 429 || status === 503
}

async function withAiRetry(task, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await task()
        } catch (error) {
            if (attempt === retries || !isTransientAiError(error)) {
                throw error
            }

            await sleep(800 * (attempt + 1))
        }
    }
}

const deriveTitleFromJobDescription = (jobDescription = "") => {
    const firstLine = jobDescription.replace(/\r/g, "").split("\n").map((line) => line.trim()).find(Boolean)
    if (!firstLine) {
        return "Target Role"
    }

    return firstLine.length > 80 ? `${firstLine.slice(0, 77).trim()}...` : firstLine
}

const escapeHtml = (value = "") => String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;")

function buildFallbackResumeHtml({ resume = "", selfDescription = "", jobDescription = "" }) {
        const name = (resume.split(/\r?\n/).map((line) => line.trim()).find((line) => /^[A-Za-z][A-Za-z\s.]{2,50}$/.test(line)) || "Candidate").trim()
        const role = deriveTitleFromJobDescription(jobDescription)
        const summary = (selfDescription || "Professional profile tailored to the target role.").trim()
        const bullets = resume
                .split(/\r?\n/)
                .map((line) => line.trim().replace(/^[•\-*]\s*/, ""))
                .filter(Boolean)
                .slice(0, 14)

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(name)} Resume</title>
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 26px; color: #172033; }
        .page { border: 1px solid #e3e9f1; border-radius: 14px; overflow: hidden; }
        header { background: #172033; color: #fff; padding: 20px 24px; }
        h1 { margin: 0 0 4px; font-size: 26px; }
        .role { margin: 0; opacity: 0.92; }
        .content { padding: 20px 24px; }
        h2 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #4b5f7a; }
        p { margin: 0 0 14px; line-height: 1.5; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 7px; line-height: 1.45; }
    </style>
</head>
<body>
    <div class="page">
        <header>
            <h1>${escapeHtml(name)}</h1>
            <p class="role">${escapeHtml(role)}</p>
        </header>
        <div class="content">
            <h2>Professional Summary</h2>
            <p>${escapeHtml(summary)}</p>
            <h2>Highlights</h2>
            <ul>
                ${bullets.map((line) => `<li>${escapeHtml(line)}</li>`).join("") || "<li>Tailored resume highlights unavailable from source text.</li>"}
            </ul>
        </div>
    </div>
</body>
</html>
        `
}

function buildFallbackInterviewReport({ resume = "", selfDescription = "", jobDescription = "" }) {
    const sourceText = `${resume}\n${selfDescription}\n${jobDescription}`.toLowerCase()
    const keywords = [ "react", "node", "express", "mongodb", "api", "javascript", "typescript" ]
    const hits = keywords.filter((item) => sourceText.includes(item)).length
    const matchScore = Math.max(55, Math.min(90, 55 + (hits * 5)))

    return {
        title: deriveTitleFromJobDescription(jobDescription),
        matchScore,
        technicalQuestions: [
            {
                question: "Walk through a relevant project and explain your architecture decisions.",
                intention: "Assess depth of technical ownership and design thinking.",
                answer: "Use a clear structure: context, constraints, chosen design, trade-offs, and measurable outcome."
            },
            {
                question: "How would you break down this role's key technical requirements into milestones?",
                intention: "Evaluate planning, prioritization, and execution approach.",
                answer: "Split work into phases, define dependencies, and include testing/monitoring checkpoints."
            },
            {
                question: "How do you debug production issues with limited information?",
                intention: "Measure troubleshooting method and reliability mindset.",
                answer: "Discuss reproduction, logs/metrics, hypothesis testing, and post-incident prevention."
            },
            {
                question: "What quality practices do you follow before shipping features?",
                intention: "Check engineering discipline and risk management.",
                answer: "Cover code reviews, automated tests, rollout strategy, and rollback readiness."
            },
            {
                question: "How do you evaluate and choose between alternative implementations?",
                intention: "Assess trade-off analysis and decision making.",
                answer: "Compare complexity, scalability, maintainability, cost, and user impact."
            }
        ],
        behavioralQuestions: [
            {
                question: "Tell me about a time you handled conflicting priorities.",
                intention: "Assess stakeholder communication and prioritization.",
                answer: "Use STAR format and focus on alignment process and outcome impact."
            },
            {
                question: "Describe a mistake you made and how you handled it.",
                intention: "Evaluate ownership and growth mindset.",
                answer: "Be specific, show accountability, and explain what changed afterward."
            },
            {
                question: "How do you collaborate when requirements are unclear?",
                intention: "Measure proactive communication and ambiguity handling.",
                answer: "Explain how you clarify assumptions, align on scope, and iterate quickly."
            },
            {
                question: "Give an example of helping a teammate succeed.",
                intention: "Assess teamwork and mentorship behavior.",
                answer: "Share a concrete example with actions and measurable team outcome."
            },
            {
                question: "Why does this role align with your strengths?",
                intention: "Check motivation and role fit.",
                answer: "Connect your past impact and strengths to this role's priorities."
            }
        ],
        skillGaps: [
            { skill: "Role-specific domain depth", severity: "high" },
            { skill: "Advanced system design storytelling", severity: "medium" },
            { skill: "Behavioral response structure", severity: "low" },
        ],
        preparationPlan: [
            { day: 1, focus: "Role analysis", tasks: [ "Extract top 5 responsibilities from JD", "Map your projects to each responsibility" ] },
            { day: 2, focus: "Technical deep dive", tasks: [ "Prepare 2 architecture walkthroughs", "Practice trade-off explanations" ] },
            { day: 3, focus: "Behavioral readiness", tasks: [ "Draft STAR stories", "Refine concise outcome-focused responses" ] },
            { day: 4, focus: "Gap closure", tasks: [ "Review missing concepts", "Build one mini demo or case study" ] },
            { day: 5, focus: "Mock interview", tasks: [ "Run full mock session", "Improve weak answers and final notes" ] },
        ]
    }
}


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

    const ai = getAiClient()


    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`

    try {
        const response = await withAiRetry(() => ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(interviewReportSchema),
            }
        }))

        return JSON.parse(response.text)
    } catch (error) {
        if (isTransientAiError(error)) {
            return buildFallbackInterviewReport({ resume, selfDescription, jobDescription })
        }

        throw error
    }


}



async function generatePdfFromHtml(htmlContent) {
    const executablePath = await chromium.executablePath()

    const browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    let htmlContent = ""

    try {
        const ai = getAiClient()
        const response = await withAiRetry(() => ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(resumePdfSchema),
            }
        }))

        const jsonContent = JSON.parse(response.text)
        htmlContent = typeof jsonContent?.html === "string" ? jsonContent.html.trim() : ""
    } catch (error) {
        console.error("Falling back to local resume PDF generation:", error)
    }

    if (!htmlContent) {
        htmlContent = buildFallbackResumeHtml({ resume, selfDescription, jobDescription })
    }

    const pdfBuffer = await generatePdfFromHtml(htmlContent)

    return pdfBuffer

}

module.exports = { generateInterviewReport, generateResumePdf }