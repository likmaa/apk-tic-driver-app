import React, { useEffect, useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { logger, LogEntry } from './utils/logger';

export default function DevPanel() {
    const navigation = useNavigation();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'raw'>('list');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        const fetchedLogs = await logger.getLocalLogs();
        setLogs(fetchedLogs);
    };

    const clearLogs = async () => {
        if (confirm('Effacer tous les logs locaux ?')) {
            await logger.clearLocalLogs();
            setLogs([]);
        }
    };

    const shareLogs = async () => {
        try {
            await Share.share({
                message: JSON.stringify(logs, null, 2),
            });
        } catch (error) {
            console.error(error);
        }
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'error': return '#EF4444';
            case 'warning': return '#F59E0B';
            case 'info': return '#3B82F6';
            default: return '#6B7280';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.black} />
                </TouchableOpacity>
                <Text style={styles.title}>Panel Développeur</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={shareLogs} style={styles.headerBtn}>
                        <Ionicons name="share-social-outline" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearLogs} style={styles.headerBtn}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.envInfo}>
                <Text style={styles.envText}>API: {process.env.EXPO_PUBLIC_API_URL}</Text>
                <Text style={styles.envText}>Env: {__DEV__ ? 'Development' : 'Production'}</Text>
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, viewMode === 'list' && styles.activeTab]}
                    onPress={() => setViewMode('list')}
                >
                    <Text style={[styles.tabText, viewMode === 'list' && styles.activeTabText]}>Liste</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, viewMode === 'raw' && styles.activeTab]}
                    onPress={() => setViewMode('raw')}
                >
                    <Text style={[styles.tabText, viewMode === 'raw' && styles.activeTabText]}>JSON Brute</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'list' ? (
                <ScrollView style={styles.logList}>
                    {logs.length === 0 ? (
                        <Text style={styles.emptyText}>Aucun log disponible.</Text>
                    ) : (
                        logs.map((log, index) => (
                            <View key={index} style={styles.logItem}>
                                <View style={styles.logHeader}>
                                    <View style={[styles.levelBadge, { backgroundColor: getLevelColor(log.level) }]}>
                                        <Text style={styles.levelText}>{log.level.toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.timestamp}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
                                </View>
                                <Text style={styles.message}>{log.message}</Text>
                                {log.context && (
                                    <View style={styles.contextContainer}>
                                        <Text style={styles.context}>{JSON.stringify(log.context, null, 2)}</Text>
                                    </View>
                                )}
                            </View>
                        ))
                    )}
                </ScrollView>
            ) : (
                <ScrollView style={styles.rawContainer}>
                    <Text style={styles.rawText}>{JSON.stringify(logs, null, 2)}</Text>
                </ScrollView>
            )}

            <TouchableOpacity style={styles.refreshBtn} onPress={loadLogs}>
                <Ionicons name="refresh" size={24} color="white" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backBtn: {
        padding: 4,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontFamily: Fonts.titilliumWebBold,
        marginLeft: 12,
        color: Colors.black,
    },
    headerActions: {
        flexDirection: 'row',
    },
    headerBtn: {
        padding: 8,
        marginLeft: 8,
    },
    envInfo: {
        padding: 12,
        backgroundColor: '#1F2937',
    },
    envText: {
        color: '#9CA3AF',
        fontSize: 11,
        fontFamily: 'monospace',
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary,
    },
    tabText: {
        fontSize: 14,
        fontFamily: Fonts.titilliumWeb,
        color: '#6B7280',
    },
    activeTabText: {
        color: Colors.primary,
        fontFamily: Fonts.titilliumWebBold,
    },
    logList: {
        flex: 1,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#9CA3AF',
        fontFamily: Fonts.titilliumWeb,
    },
    logItem: {
        backgroundColor: 'white',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    levelBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    levelText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    timestamp: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    message: {
        fontSize: 14,
        color: '#1F2937',
        fontFamily: Fonts.titilliumWebBold,
    },
    contextContainer: {
        marginTop: 6,
        backgroundColor: '#F9FAFB',
        padding: 6,
        borderRadius: 4,
    },
    context: {
        fontSize: 11,
        color: '#4B5563',
        fontFamily: 'monospace',
    },
    rawContainer: {
        flex: 1,
        backgroundColor: '#1E1E1E',
        padding: 12,
    },
    rawText: {
        color: '#A5D6A7',
        fontSize: 12,
        fontFamily: 'monospace',
    },
    refreshBtn: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    }
});
