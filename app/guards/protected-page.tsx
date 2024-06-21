import { redirect } from "next/navigation";
import { ComponentType, useEffect } from "react";
import { useUser } from "../hooks/useUser";
import Loading from "../components/loading";

const AuthGuard = <P extends object>(WrappedComponent: ComponentType<P>) => {
    const WithAuthGuard = (props: P) => {
        const { user, loading } = useUser();

        useEffect(() => {
            if ((!user || !user.token) && !loading) {
                return redirect("/");
            }
        }, [user]);
        if (loading) return <Loading/>
        return <WrappedComponent {...props} user={user} />;
    };
    return WithAuthGuard;
};

export default AuthGuard;