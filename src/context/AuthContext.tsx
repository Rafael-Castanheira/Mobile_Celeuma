import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import type { AuthUser } from "../lib/360api";

type AuthContextValue = {
	user: AuthUser | null;
	token: string | null;
	setAuth: (user: AuthUser, token: string) => void;
	clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [token, setToken] = useState<string | null>(null);

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				setAuth: (newUser, newToken) => {
					setUser(newUser);
					setToken(newToken);
				},
				clearAuth: () => {
					setUser(null);
					setToken(null);
				},
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
	return ctx;
}
