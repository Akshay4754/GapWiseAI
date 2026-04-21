const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

for (const localOrigin of [ "http://localhost:5173", "http://localhost:5174" ]) {
    if (!allowedOrigins.includes(localOrigin)) {
        allowedOrigins.push(localOrigin)
    }
}

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }

        return callback(new Error("Not allowed by CORS"))
    },
    credentials: true
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

app.use((err, req, res, next) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            message: "Resume file must be 5MB or smaller."
        })
    }

    if (err?.message === "Not allowed by CORS") {
        return res.status(403).json({
            message: "Frontend origin is not allowed by CORS configuration."
        })
    }

    if (err) {
        console.error(err)
        return res.status(err.status || 500).json({
            message: err.message || "Something went wrong on the server."
        })
    }

    return next()
})



module.exports = app