import AsyncStorage from "@react-native-async-storage/async-storage/lib/commonjs";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { getMe, type AuthUser } from "../lib/360api";

const AUTH_STORAGE_KEY = "@galerias360:auth";

type PersistedAuth = {
	token: string;
	user: AuthUser;
};

type AuthContextValue = {
	user: AuthUser | null;
	token: string | null;
	isLoadingAuth: boolean;
	setAuth: (user: AuthUser, token: string) => void;
	clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [isLoadingAuth, setIsLoadingAuth] = useState(true);

	useEffect(() => {
		async function restoreAuth() {
			try {
				const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
				if (!raw) return;

				const parsed = JSON.parse(raw) as Partial<PersistedAuth>;
				if (!parsed?.token) return;

				const refreshedUser = await getMe(parsed.token);
				setUser(refreshedUser);
				setToken(parsed.token);
				await AsyncStorage.setItem(
					AUTH_STORAGE_KEY,
					JSON.stringify({ token: parsed.token, user: refreshedUser })
				);
			} catch {
				setUser(null);
				setToken(null);
				await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
			} finally {
				setIsLoadingAuth(false);
			}
		}

		restoreAuth();
	}, []);

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				isLoadingAuth,
				setAuth: (newUser, newToken) => {
					setUser(newUser);
					setToken(newToken);
					void AsyncStorage.setItem(
						AUTH_STORAGE_KEY,
						JSON.stringify({ token: newToken, user: newUser })
					);
				},
				clearAuth: () => {
					setUser(null);
					setToken(null);
					void AsyncStorage.removeItem(AUTH_STORAGE_KEY);
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
