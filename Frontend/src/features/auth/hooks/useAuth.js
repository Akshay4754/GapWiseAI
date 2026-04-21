import { useContext, useEffect } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";



export const useAuth = () => {

    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading } = context


    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        try {
            const data = await login({ email, password })
            if (!data || !data.token || !data.user) {
                throw new Error("Invalid credentials")
            }
            localStorage.setItem("token", data.token)
            setUser(data.user)
        } catch (err) {
            localStorage.removeItem("token")
            setUser(null)
            throw err
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true)
        try {
            const data = await register({ username, email, password })
            if (!data || !data.token || !data.user) {
                throw new Error("Registration failed")
            }
            localStorage.setItem("token", data.token)
            setUser(data.user)
        } catch (err) {
            localStorage.removeItem("token")
            setUser(null)
            throw err
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
            await logout()
        } catch (err) {
        } finally {
            localStorage.removeItem("token")
            setUser(null)
            setLoading(false)
        }
    }

    useEffect(() => {

        const getAndSetUser = async () => {
            try {
                const data = await getMe()
                if (data?.user) {
                    setUser(data.user)
                } else {
                    setUser(null)
                    localStorage.removeItem("token")
                }
            } catch (err) {
                setUser(null)
                localStorage.removeItem("token")
            } finally {
                setLoading(false)
            }
        }

        getAndSetUser()

    }, [])

    return { user, loading, handleRegister, handleLogin, handleLogout }
}