import { Feather } from "@expo/vector-icons";
import { Redirect, useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrandLogo from "../components/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../context/ThemeContext";
import { getLandingContent, loginUser, type LandingContent } from "../lib/360api";
import { getAuthenticatedHomeRoute, isAdminRole } from "../lib/auth";

export default function Login() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { user, isLoadingAuth, setAuth } = useAuth();
  const { colors, activePreset } = useAppTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landing, setLanding] = useState<LandingContent | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLanding() {
      try {
        setLanding(await getLandingContent(controller.signal));
      } catch {
        setLanding(null);
      }
    }

    loadLanding();
    return () => controller.abort();
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Preencha o e-mail e a senha.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await loginUser(email.trim(), password);
      setAuth(user, token);
      router.replace(
        (isAdminRole(user.role) ? "/admin" : getAuthenticatedHomeRoute(user.role)) as Href
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  if (isLoadingAuth) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href={getAuthenticatedHomeRoute(user.role)} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.muted, paddingTop: top, paddingBottom: bottom + 12 }]}> 
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}> 
        <View style={styles.header}>
          <BrandLogo size={74} iconSize={34} withFrame />
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Entrar</Text>
          <Text style={[styles.heroDescription, { color: colors.mutedForeground }]}>
            {landing?.description ?? activePreset?.description ?? "Acede à tua conta para continuar."}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputBlock}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>

        {/* Mensagem de erro */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.accentSoft, borderColor: colors.destructive }]}> 
            <Feather name="alert-circle" size={15} color={colors.destructive} style={{ marginRight: 8 }} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="mail" size={18} color={colors.iconMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="E-mail"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
        </View>
          </View>

        <View style={styles.inputBlock}>
          <View style={styles.passwordLabelRow}>
            <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
            <Pressable style={styles.forgotWrapper}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>Esqueceu-se da password?</Text>
            </Pressable>
          </View>
        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="lock" size={18} color={colors.iconMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1, color: colors.foreground }]}
            placeholder="Senha"
            placeholderTextColor={colors.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={18}
              color={colors.iconMuted}
            />
          </Pressable>
        </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.loginBtn,
            { backgroundColor: loading ? colors.buttonDisabled : colors.primary, shadowColor: colors.shadow },
            pressed && styles.loginBtnPressed,
            loading && styles.loginBtnDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>Entrar</Text>
          )}
        </Pressable>
        </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Ainda não está registado? </Text>
        <Pressable>
          <Text style={[styles.footerLink, { color: colors.primary }]}>Criar conta</Text>
        </Pressable>
      </View>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "center",
  },
  root: {
    flex: 1,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  heroDescription: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },
  form: {
    gap: 12,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 12,
  },
  inputBlock: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  forgotWrapper: {
    paddingVertical: 2,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loginBtn: {
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  loginBtnPressed: {
    opacity: 0.8,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
