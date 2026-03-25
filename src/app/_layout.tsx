import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { DialogProvider } from "../context/DialogContext";
import { ThemeProvider } from "../context/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DialogProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="admin" />
          </Stack>
        </DialogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
