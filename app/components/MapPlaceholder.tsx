import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface MapPlaceholderProps {
    height?: number;
}

export function MapPlaceholder({ height = 400 }: MapPlaceholderProps) {
    return (
        <View style={[styles.container, { height }]}>
            {/* Image de carte statique */}
            <Image
                source={require('../../assets/images/map-placeholder.png')}
                style={styles.mapImage}
                resizeMode="cover"
            />
            {/* Overlay gradient pour effet de profondeur */}
            <LinearGradient
                colors={['rgba(0,102,204,0.15)', 'transparent', 'rgba(245,245,245,0.8)']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
    },
    mapImage: {
        width: '100%',
        height: '100%',
    },
});
