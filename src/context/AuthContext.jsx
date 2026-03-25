import AsyncStorage from "@react-native-async-storage/async-storage/lib/commonjs";
import { createContext, useContext, useEffect, useState } from "react";
import { getMe } from "../lib/360api";

const AUTH_STORAGE_KEY = "@galerias360:auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [token, setToken] = useState(null);
	const [isLoadingAuth, setIsLoadingAuth] = useState(true);

	useEffect(() => {
		async function restoreAuth() {
			try {
				const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
				if (!raw) return;

				const parsed = JSON.parse(raw);
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
