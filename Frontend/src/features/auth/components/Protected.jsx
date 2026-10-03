import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router";
import React from 'react'
import BrandLogo from "../../../components/BrandLogo.jsx";

const hasSavedToken = () => {
    try {
        return Boolean(localStorage.getItem("token"))
    } catch {
        return false
    }
}

const Protected = ({children}) => {
    const { loading,user } = useAuth()

    if(loading){
        // With a saved login, show the page straight away while the session is
        // verified in the background (the API can take a while to wake up).
        if (hasSavedToken()) {
            return children
        }

        // No saved login: the session may still come from a cookie, so wait
        // briefly on a quiet branded splash instead of a bare "Loading..." line.
        return (
            <main className="app-splash" aria-busy="true" aria-label="Checking your session">
                <BrandLogo />
            </main>
        )
    }

    if(!user){
        return <Navigate to={'/login'} replace />
    }

    return children
}

export default Protected
