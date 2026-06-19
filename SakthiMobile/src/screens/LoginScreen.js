import React, { useState, useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { FadeInView, Field, GlowOrb, GradientButton, IconMark, PremiumCard, StatusBadge } from '../components/Premium';
import { colors, font, gradients, radius, shadow, softShadow, spacing, tracking, type } from '../theme';

export default function LoginScreen() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { login, register, isLoading } = useContext(AuthContext);

  const switchMode = next => {
    setErrorMessage('');
    setMode(next);
  };

  const handleLogin = async () => {
    setErrorMessage('');
    if (loginId.trim() && password.trim()) {
      const result = await login(loginId.trim(), password);
      if (!result?.ok) {
        setErrorMessage(result?.message || 'Login failed.');
      }
    } else {
      setErrorMessage('Enter your username/email and password.');
    }
  };

  const handleRegister = async () => {
    setErrorMessage('');
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Choose a username and password to create your account.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    const result = await register({
      username: username.trim(),
      password,
      email: email.trim(),
      first_name: fullName.trim(),
      phone_number: phone.trim(),
    });
    if (!result?.ok) {
      setErrorMessage(result?.message || 'Could not create account.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <GlowOrb color={colors.primary} size={380} intensity={0.42} style={styles.glowTop} />
      <GlowOrb color={colors.danger} size={320} intensity={0.3} style={styles.glowBottom} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.topLine} />

          <FadeInView style={styles.hero}>
            <View style={styles.brandRow}>
              <IconMark name="shield" tone="primary" size={52} style={styles.brandMark} />
              <View style={styles.brandText}>
                <StatusBadge label="Personal safety OS" tone="danger" />
                <Text style={styles.brandName}>Sakthi</Text>
              </View>
            </View>
            <Text style={styles.title}>Stay safe.{'\n'}Always within reach.</Text>
            <Text style={styles.subtitle}>
              SOS, live route awareness, voice alerts, and trusted contacts — built for the moments that matter.
            </Text>
          </FadeInView>

          <FadeInView delay={120}>
            <PremiumCard style={styles.form}>
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.modeTab, mode === 'signin' && styles.modeTabActive]}
                  onPress={() => switchMode('signin')}>
                  <Text style={[styles.modeTabText, mode === 'signin' && styles.modeTabTextActive]}>Sign in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
                  onPress={() => switchMode('signup')}>
                  <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>Create account</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
                <Text style={styles.formCaption}>
                  {mode === 'signin'
                    ? 'Sign in to continue to your safety dashboard.'
                    : 'Set up your account to start protecting yourself.'}
                </Text>
              </View>

              {mode === 'signup' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full name</Text>
                  <Field placeholder="Your name" value={fullName} onChangeText={setFullName} returnKeyType="next" />
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{mode === 'signin' ? 'Username or email' : 'Username'}</Text>
                {mode === 'signin' ? (
                  <Field
                    placeholder="you@example.com"
                    value={loginId}
                    onChangeText={setLoginId}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                ) : (
                  <Field
                    placeholder="Choose a username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                )}
              </View>

              {mode === 'signup' && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email (optional)</Text>
                    <Field
                      placeholder="you@example.com"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      returnKeyType="next"
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Phone (optional)</Text>
                    <Field
                      placeholder="Your phone number"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                    />
                  </View>
                </>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <Field
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Create a password (min 6 characters)'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={mode === 'signin' ? handleLogin : handleRegister}
                />
              </View>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <GradientButton
                title={mode === 'signin' ? 'Sign in' : 'Create account'}
                stops={gradients.brand}
                onPress={mode === 'signin' ? handleLogin : handleRegister}
                loading={isLoading}
                style={styles.signInButton}
              />
            </PremiumCard>
          </FadeInView>

          <Text style={styles.footnote}>
            By continuing you agree to keep your trusted contacts up to date.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasDark,
  },
  glowTop: { position: 'absolute', top: -120, left: -110 },
  glowBottom: { position: 'absolute', bottom: -90, right: -100 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.danger,
  },
  hero: { marginBottom: spacing.xl },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  brandMark: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  brandText: { justifyContent: 'center' },
  brandName: {
    color: '#fff',
    fontFamily: font.black,
    fontSize: 20,
    letterSpacing: tracking.snug,
    marginTop: 6,
  },
  title: {
    fontFamily: font.black,
    fontSize: type.hero,
    color: '#fff',
    letterSpacing: tracking.tight,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.onDarkMuted,
    lineHeight: 23,
    marginTop: spacing.md,
  },
  form: {
    borderColor: 'rgba(255,255,255,0.10)',
    padding: spacing.xl,
    ...shadow,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    ...softShadow,
  },
  modeTabText: { color: colors.muted, fontFamily: font.bold, fontSize: type.caption, letterSpacing: tracking.snug },
  modeTabTextActive: { color: colors.ink },
  formHeader: {
    marginBottom: spacing.lg,
  },
  formTitle: {
    color: colors.ink,
    fontFamily: font.black,
    fontSize: 22,
    letterSpacing: tracking.tight,
  },
  formCaption: {
    color: colors.muted,
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.steel,
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.dangerDark,
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  signInButton: {
    marginTop: spacing.xs,
  },
  footnote: {
    color: colors.onDarkMuted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
