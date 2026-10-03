import { createContext,useState } from "react";


export const InterviewContext = createContext()

export const InterviewProvider = ({ children }) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [report, setReport] = useState(null)
    const [reports, setReports] = useState([])
    // Becomes true once the reports list has been fetched (successfully or not)
    const [reportsLoaded, setReportsLoaded] = useState(false)

    return (
        <InterviewContext.Provider value={{ loading, setLoading, error, setError, report, setReport, reports, setReports, reportsLoaded, setReportsLoaded }}>
            {children}
        </InterviewContext.Provider>
    )
}