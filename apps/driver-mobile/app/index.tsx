import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../src/app-context';
import { apiBaseUrl } from '../src/mobile-api';
import { colors, common } from '../src/theme';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit() { setLoading(true); setError(''); try { await login(email, password); router.replace('/home'); } catch (cause) { setError(cause instanceof TypeError ? `Cannot reach FuelTrack API at ${apiBaseUrl()}.` : cause instanceof Error ? cause.message : 'Unable to sign in.'); } finally { setLoading(false); } }
  return <SafeAreaView style={s.screen}><View style={s.logo}><Text style={s.logoText}>FT</Text></View><Text style={common.kicker}>FUELTRACK DRIVER</Text><Text style={s.title}>Welcome back</Text><Text style={s.copy}>Sign in to view your assigned delivery.</Text><View style={s.form}><TextInput style={s.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="Email address"/><TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password"/>{error ? <Text style={s.error}>{error}</Text> : null}<Pressable style={common.button} onPress={submit} disabled={loading}>{loading ? <ActivityIndicator color="#fff"/> : <Text style={common.buttonText}>Sign in</Text>}</Pressable></View></SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:colors.bg,padding:28,justifyContent:'center'},logo:{width:52,height:52,borderRadius:14,backgroundColor:'#0b382b',alignItems:'center',justifyContent:'center',marginBottom:36},logoText:{color:'#fff',fontSize:18,fontWeight:'900'},title:{fontSize:38,fontWeight:'800',color:colors.dark,marginTop:10},copy:{fontSize:16,color:colors.muted,marginTop:8},form:{gap:16,marginTop:36},input:{backgroundColor:'#fff',borderWidth:1,borderColor:colors.line,borderRadius:12,padding:16,fontSize:16},error:{color:colors.red,lineHeight:20}});
