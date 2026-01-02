import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

interface StatCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    value: string | number;
    label: string;
    color?: string;
}

export function StatCard({ icon, value, label, color = Colors.primary }: StatCardProps) {
    return (
        <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    statCard: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
        minHeight: 110,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    statValue: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 22,
        color: Colors.black,
    },
    statLabel: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 11,
        color: Colors.gray,
        textAlign: 'center',
        lineHeight: 14,
    },
});
