import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

interface ActionCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    fullWidth?: boolean;
    value?: string | number; // Montant à afficher (optionnel)
}

export function ActionCard({ icon, label, onPress, fullWidth = false, value }: ActionCardProps) {
    return (
        <TouchableOpacity
            style={[styles.actionCard, fullWidth && styles.fullWidth]}
            onPress={onPress}
            activeOpacity={0.7}
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
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    actionCard: {
        flex: 1,
        backgroundColor: 'rgba(0,102,204,0.06)',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,102,204,0.12)',
        minHeight: 90,
    },
    fullWidth: {
        flex: undefined,
        width: '100%',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(0,102,204,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    actionLabel: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 13,
        color: Colors.black,
        marginBottom: 2,
    },
    valueText: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 18,
        color: Colors.primary,
    },
});
