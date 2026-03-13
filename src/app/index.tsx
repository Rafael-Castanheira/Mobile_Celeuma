import { Redirect, type Href } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { getAuthenticatedHomeRoute } from "../lib/auth";

export default function Root() {
	const { user } = useAuth();

	const href: Href = user ? getAuthenticatedHomeRoute(user.role) : "/login";

	return <Redirect href={href} />;
}
