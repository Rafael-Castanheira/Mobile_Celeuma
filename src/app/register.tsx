import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrandLogo from "../components/BrandLogo";
import { useAppTheme } from "../context/ThemeContext";
import { registerUser } from "../lib/360api";

export default function Register() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRegister() {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setSuccess(null);
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (password !== confirmPassword) {
      setSuccess(null);
      setError("As palavras-passe não coincidem.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const message = await registerUser(cleanName, cleanEmail, password);
      setSuccess(message);
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setSuccess(null);
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.muted, paddingTop: top, paddingBottom: bottom + 12 }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.header}>
              <BrandLogo size={68} iconSize={30} withFrame />
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Criar conta</Text>
              <Text style={[styles.heroDescription, { color: colors.mutedForeground }]}> 
                Preencha os dados para criar a conta. Depois confirme o e-mail para entrar.
              </Text>
            </View>

          <View style={styles.form}>
            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.accentSoft, borderColor: colors.destructive }]}> 
                <Feather name="alert-circle" size={15} color={colors.destructive} style={{ marginRight: 8 }} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            {success && (
              <View style={[styles.successBox, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}> 
                <Feather name="check-circle" size={15} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.errorText, { color: colors.foreground }]}>{success}</Text>
              </View>
            )}

            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Nome</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Feather name="user" size={18} color={colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Nome"
                  placeholderTextColor={colors.placeholder}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
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
              <Text style={[styles.label, { color: colors.foreground }]}>Senha</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Feather name="lock" size={18} color={colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.foreground }]}
                  placeholder="Senha"
                  placeholderTextColor={colors.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password-new"
                  returnKeyType="next"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.iconMuted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Confirmar senha</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Feather name="lock" size={18} color={colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.foreground }]}
                  placeholder="Confirmar senha"
                  placeholderTextColor={colors.placeholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="password-new"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <Pressable onPress={() => setShowConfirmPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showConfirmPassword ? "eye-off" : "eye"} size={18} color={colors.iconMuted} />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.registerBtn,
                { backgroundColor: loading ? colors.buttonDisabled : colors.primary, shadowColor: colors.shadow },
                pressed && styles.registerBtnPressed,
                loading && styles.registerBtnDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <Text style={[styles.registerBtnText, { color: colors.primaryForeground }]}>Aguarde...</Text>
              ) : (
                <Text style={[styles.registerBtnText, { color: colors.primaryForeground }]}>Criar Conta</Text>
              )}
            </Pressable>
          </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Já tem conta? </Text>
              <Pressable onPress={() => router.replace("/login")}>
                <Text style={[styles.footerLink, { color: colors.primary }]}>Iniciar sessão</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  header: {
    alignItems: "center",
    marginBottom: 14,
  },
  heroDescription: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
  form: {
    gap: 10,
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
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
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
  registerBtn: {
    borderRadius: 10,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  registerBtnPressed: {
    opacity: 0.8,
  },
  registerBtnDisabled: {
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
  successBox: {
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
  registerBtnText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
