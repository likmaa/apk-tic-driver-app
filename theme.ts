// driver-app/theme.ts

export const Colors = {
  primary: "#3650D0",
  primaryDark: "#1E2D7D",
  secondary: "#FF7B00",
  secondaryDark: "#E66E00",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  white: "#FFFFFF",
  black: "#1A1A1A",
  gray: "#6B7280",
  lightGray: "#F3F4F6",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  glass: "rgba(255, 255, 255, 0.7)",
};

export const Gradients = {
  primary: [Colors.primary, Colors.primaryDark],
  secondary: [Colors.secondary, "#FFAD60"],
  success: [Colors.success, "#059669"],
  dark: ["#1A1A1A", "#333333"],
  glass: ["rgba(255, 255, 255, 0.2)", "rgba(255, 255, 255, 0.05)"],
  wallet: ["#FF6B35", "#F7931E", "#E65100"],
} as const;

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#3650D0",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
};

export default { Colors, Gradients, Shadows };
