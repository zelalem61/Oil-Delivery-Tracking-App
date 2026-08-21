import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import { actionLabel, type TripStatus } from '../src/domain';
import { colors, common } from '../src/theme';

export default function Trip() {
  const { delivery, advanceTrip, enqueue, queue } = useApp();
  const [tracking, setTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<string>('Waiting for GPS…');
  useEffect(() => {
    if (!delivery || delivery.status === 'DELIVERED') return;
    let active = true;
    let subscription: Location.LocationSubscription | undefined;
    const record = (position: Location.LocationObject) => {
      if (!active) return;
      const payload = { deliveryId: delivery.id, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, speed: position.coords.speed, heading: position.coords.heading, timestamp: new Date(position.timestamp).toISOString() };
      void enqueue('LOCATION', payload);
      setLastLocation(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`);
    };
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (active) setLastLocation('Location permission required');
          Alert.alert('Location required','Allow location access so FuelTrack can record this active trip every 10 seconds.');
          return;
        }
        setLastLocation('Getting current position…');
        record(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 0 },
          record,
        );
        if (active) setTracking(true); else subscription.remove();
      } catch {
        if (active) setLastLocation('GPS unavailable');
      }
    })();
    return () => { active = false; subscription?.remove(); setTracking(false); };
  }, [delivery?.id]);
  function next() {
    if (!delivery) return;
    const statusChanges: Partial<Record<TripStatus, string>> = {
      CREATED: 'DISPATCHED',
      DISPATCHED: 'IN TRANSIT',
      IN_TRANSIT: 'ARRIVED',
      ARRIVED: 'UNLOADING',
      UNLOADING: 'AWAITING DELIVERY APPROVAL',
    };
    const nextStatus = statusChanges[delivery.status];
    if (!nextStatus) return;
    Alert.alert(
      'Confirm status change',
      `Change delivery status from ${delivery.status.replaceAll('_', ' ')} to ${nextStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => void advanceTrip() },
      ],
    );
  }
  if(!delivery)return <SafeAreaView style={common.screen}><View style={common.content}><Text style={common.title}>No active delivery</Text><Pressable style={common.button} onPress={()=>router.replace('/home')}><Text style={common.buttonText}>Driver home</Text></Pressable></View></SafeAreaView>;
  const action = actionLabel[delivery.status];
  return <SafeAreaView style={common.screen}><ScrollView contentContainerStyle={common.content}><Pressable onPress={()=>router.back()}><Text style={s.back}>← Driver home</Text></Pressable><View><Text style={common.kicker}>{delivery.deliveryNumber}</Text><Text style={common.title}>Live trip</Text></View><View style={s.statusCard}><Text style={common.label}>Current status</Text><Text style={s.status}>{delivery.status.replaceAll('_',' ')}</Text><Text style={s.route}>{delivery.origin} → {delivery.destination}</Text></View><View style={s.metrics}><View style={common.card}><Text style={common.label}>Fuel</Text><Text style={common.value}>{delivery.fuelProduct}</Text></View><View style={common.card}><Text style={common.label}>Quantity</Text><Text style={common.value}>{delivery.quantityLiters.toLocaleString()} L</Text></View></View><View style={common.card}><Text style={common.label}>AUTOMATIC GPS · EVERY 10 SECONDS</Text><Text style={common.value}>{lastLocation}</Text><Text style={s.note}>{tracking?'Tracking active while this screen is open':'Starting location tracking…'}</Text><Text style={s.note}>{queue.filter(e=>e.type==='LOCATION'&&e.payload.deliveryId===delivery.id).length} GPS points queued locally</Text></View>{action ? <Pressable style={common.button} onPress={next}><Text style={common.buttonText}>{action}</Text></Pressable> : <View style={common.card}><Text style={s.complete}>{delivery.status==='AWAITING_DELIVERY_APPROVAL'?'Waiting for admin to approve DELIVERED status':'Delivery approved by admin'}</Text></View>}<Pressable style={s.incident} onPress={()=>router.push('/incident')}><Text style={s.incidentText}>Report an incident</Text></Pressable><Text style={s.disclaimer}>Location is recorded automatically while this trip screen is open. Drivers control operational progress. Only an administrator can mark this delivery DELIVERED.</Text></ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({back:{color:colors.green,fontWeight:'800'},statusCard:{backgroundColor:'#0b382b',padding:22,borderRadius:18},status:{color:'#fff',fontWeight:'900',fontSize:27,marginTop:7},route:{color:'#b8d4c9',marginTop:10,lineHeight:21},metrics:{flexDirection:'row',gap:12},note:{color:colors.muted,marginTop:8},incident:{minHeight:50,alignItems:'center',justifyContent:'center'},incidentText:{color:colors.red,fontWeight:'800'},complete:{color:colors.green,fontWeight:'900',fontSize:18},disclaimer:{color:colors.muted,fontSize:12,lineHeight:18}});
