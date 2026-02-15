import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Gradients } from '../../theme';
import { Fonts } from '../../font';
import { LinearGradient } from 'expo-linear-gradient';

interface ActionCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    fullWidth?: boolean;
    value?: string | number;
}

export function ActionCard({ icon, label, onPress, fullWidth = false, value }: ActionCardProps) {
    return (
        <TouchableOpacity
            style={[styles.container, fullWidth && styles.fullWidth]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <LinearGradient
                colors={Gradients.glass}
                style={[styles.actionCard, Shadows.sm]}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={24} color={Colors.primary} />
                </View>
                <View style={styles.contentContainer}>
                    <Text style={styles.actionLabel}>{label}</Text>
                    {value !== undefined && (
                        <Text style={styles.valueText}>{value}</Text>
                    )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.border} />
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    fullWidth: {
        flex: undefined,
        width: '100%',
    },
    actionCard: {
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        minHeight: 90,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: `${Colors.primary}10`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    actionLabel: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 13,
        color: Colors.gray,
        marginBottom: 2,
    },
    valueText: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 18,
        color: Colors.black,
    },
});
