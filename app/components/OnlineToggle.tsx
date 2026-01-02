import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { Fonts } from '../../font';

interface OnlineToggleProps {
    isOnline: boolean;
    onToggle: () => void;
    loading?: boolean;
}

export function OnlineToggle({ isOnline, onToggle, loading = false }: OnlineToggleProps) {
    return (
        <TouchableOpacity
            style={[
                styles.toggleButton,
                isOnline && styles.toggleButtonOnline
            ]}
            onPress={onToggle}
            activeOpacity={0.85}
            disabled={loading}
        >
            <View style={[
                styles.toggleIcon,
                isOnline && styles.toggleIconOnline
            ]}>
                <Ionicons
                    name="power"
                    size={24}
                    color="white"
                />
            </View>
            <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleText}>
                    {isOnline ? "Passer hors ligne" : "Passer en ligne"}
                </Text>
                <Text style={styles.toggleSubtext}>
                    {isOnline ? "Vous êtes disponible" : "Vous êtes indisponible"}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        gap: 14,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    toggleButtonOnline: {
        backgroundColor: '#F0FDF4',
        borderColor: '#10B981',
    },
    toggleIcon: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleIconOnline: {
        backgroundColor: '#10B981',
    },
    toggleTextContainer: {
        flex: 1,
    },
    toggleText: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 15,
        color: Colors.black,
        marginBottom: 2,
    },
    toggleSubtext: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 12,
        color: Colors.gray,
    },
});
