import { createBrowserRouter } from "react-router";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Protected from "./features/auth/components/Protected";
import Home from "./features/interview/pages/Home";
import Workspace from "./features/interview/pages/Workspace";
import Interview from "./features/interview/pages/Interview";
import ResumeOptimizer from "./features/interview/pages/ResumeOptimizer";
import { noteViewTransition } from "./utils/viewTransition.js";


export const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/register",
        element: <Register />
    },
    {
        path: "/",
        element: <Home />
    },
    {
        path: "/workspace",
        element: <Protected><Workspace /></Protected>
    },
    {
        path: "/interview/:interviewId",
        element: <Protected><Interview /></Protected>
    },
    {
        path: "/optimize/:interviewId",
        element: <Protected><ResumeOptimizer /></Protected>
    },
    {
        path: "*",
        element: <Home />
    }
])

// Every navigation (links, redirects, navigate()) runs as a view transition,
// so pages cross-fade into each other instead of cutting. The animation itself
// lives in style.scss; browsers without the API just navigate as before.
const navigate = router.navigate.bind(router)
router.navigate = (to, options) => {
    if (typeof to === "number") {
        return navigate(to)
    }

    noteViewTransition()
    return navigate(to, { ...options, viewTransition: options?.viewTransition ?? true })
}