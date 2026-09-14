import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import mqtt, { type MqttClient } from 'mqtt'
import { toast } from 'sonner'
import {
  Activity,
  BatteryCharging,
  Check,
  Droplets,
  Gauge,
  Leaf,
  Loader2,
  Radio,
  Save,
  Settings2,
  Sprout,
  ToggleLeft,
  ToggleRight,
  Waves,
  Wifi,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'

export const Route = createFileRoute('/app/')({
  head: () => ({
    meta: [
      { title: 'IrrigaSense · Monitoramento inteligente' },
      { name: 'description', content: 'Dashboard de irrigação inteligente conectado ao seu ESP32 via MQTT.' },
    ],
  }),
  component: DashboardHome,
})

type SensorState = {
  soil: number
  reservoir: number
  battery: number
  pump: boolean
  updatedAt: Date
}

const initialSensors: SensorState = {
  soil: 64,
  reservoir: 78,
  battery: 12.6,
  pump: false,
  updatedAt: new Date(),
}

export function DashboardHome() {
  return (
    <BlinkClientBoundary
      fallback={<div className="flex min-h-dvh items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando estação…</div>}
    >
      <IrrigationDashboard />
    </BlinkClientBoundary>
  )
}

function IrrigationDashboard() {
  const clientRef = useRef<MqttClient | null>(null)
  const brokerUrl = import.meta.env.VITE_MQTT_BROKER_URL as string | undefined
  const [sensors, setSensors] = useState(initialSensors)
  const [minMoisture, setMinMoisture] = useState('42')
  const [maxMoisture, setMaxMoisture] = useState('74')
  const [saved, setSaved] = useState(false)
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'offline'>(brokerUrl ? 'connecting' : 'offline')
  const [lastEvent, setLastEvent] = useState(brokerUrl ? 'Aguardando dados do ESP32' : 'Modo demonstração · defina VITE_MQTT_BROKER_URL para conectar')

  useEffect(() => {
    if (!brokerUrl) return

    const client = mqtt.connect(brokerUrl, {
      clientId: `irrigasense-${Math.random().toString(16).slice(2)}`,
      clean: true,
      reconnectPeriod: 3000,
    })
    clientRef.current = client

    client.on('connect', () => {
      setConnection('connected')
      setLastEvent('Broker MQTT conectado agora')
      client.subscribe('irrigasense/sensors/#')
    })
    client.on('reconnect', () => setConnection('connecting'))
    client.on('offline', () => setConnection('offline'))
    client.on('error', () => {
      setConnection('offline')
      setLastEvent('Não foi possível conectar ao broker')
    })
    client.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString()) as Partial<SensorState>
        setSensors(current => ({
          ...current,
          soil: typeof data.soil === 'number' ? data.soil : current.soil,
          reservoir: typeof data.reservoir === 'number' ? data.reservoir : current.reservoir,
          battery: typeof data.battery === 'number' ? data.battery : current.battery,
          pump: typeof data.pump === 'boolean' ? data.pump : current.pump,
          updatedAt: new Date(),
        }))
        setLastEvent(`Recebido em ${topic}`)
      } catch {
        setLastEvent(`Mensagem inválida em ${topic}`)
      }
    })

    return () => {
      client.end(true)
      clientRef.current = null
    }
  }, [brokerUrl])

  const connectionLabel = connection === 'connected' ? 'MQTT conectado' : connection === 'connecting' ? 'Conectando ao MQTT' : 'Modo demonstração'
  const isDry = sensors.soil < Number(minMoisture)
  const status = isDry ? 'Irrigação recomendada' : 'Umidade ideal'
  const statusTone = isDry ? 'text-amber-700 bg-amber-100' : 'text-primary bg-primary/10'

  const timeLabel = useMemo(() => sensors.updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), [sensors.updatedAt])

  function publishPump(next: boolean) {
    setSensors(current => ({ ...current, pump: next, updatedAt: new Date() }))
    const payload = JSON.stringify({ pump: next, source: 'dashboard', timestamp: new Date().toISOString() })
    if (clientRef.current?.connected) {
      clientRef.current.publish('irrigasense/commands/pump', payload)
      setLastEvent(`Comando ${next ? 'ligar' : 'desligar'} enviado ao ESP32`)
    } else {
      setLastEvent('Comando simulado · conecte o broker para enviar ao ESP32')
    }
    toast.success(next ? 'Bomba ligada' : 'Bomba desligada', { description: 'O comando foi registrado no painel.' })
  }

  function saveThresholds() {
    const min = Number(minMoisture)
    const max = Number(maxMoisture)
    if (min < 0 || max > 100 || min >= max) {
      toast.error('Faixa inválida', { description: 'A umidade mínima deve ser menor que a máxima, entre 0 e 100%.' })
      return
    }
    if (clientRef.current?.connected) {
      clientRef.current.publish('irrigasense/config/moisture', JSON.stringify({ min, max }))
    }
    setSaved(true)
    toast.success('Configuração salva', { description: `Faixa automática definida entre ${min}% e ${max}%.` })
    window.setTimeout(() => setSaved(false), 2200)
  }

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <header className="mb-8 flex flex-col gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Sprout className="h-4 w-4" /> Estação · Horta norte</div>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground sm:text-5xl">Bom dia, sua horta está viva.</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Acompanhe os sinais da estação e mantenha a irrigação no ritmo certo.</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium"><span className={`h-2 w-2 rounded-full ${connection === 'connected' ? 'bg-primary' : connection === 'connecting' ? 'animate-pulse bg-amber-500' : 'bg-muted-foreground'}`} />{connectionLabel}</div>
            <div className="hidden text-right text-xs text-muted-foreground sm:block"><p>Última atualização</p><p className="font-mono text-foreground">Hoje, {timeLabel}</p></div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Leituras da estação">
          <MetricCard icon={<Droplets />} label="Umidade do solo" value={`${sensors.soil}%`} hint={isDry ? 'Abaixo do mínimo' : 'Dentro da faixa ideal'} progress={sensors.soil} tone="green" />
          <MetricCard icon={<Waves />} label="Nível do reservatório" value={`${sensors.reservoir}%`} hint={sensors.reservoir < 25 ? 'Reabastecer em breve' : 'Reservatório saudável'} progress={sensors.reservoir} tone="amber" />
          <MetricCard icon={<BatteryCharging />} label="Tensão da bateria" value={`${sensors.battery.toFixed(1)} V`} hint="Fonte solar ativa" progress={Math.min(sensors.battery / 14.4 * 100, 100)} tone="blue" />
          <MetricCard icon={<Activity />} label="Status da bomba" value={sensors.pump ? 'Ligada' : 'Desligada'} hint={sensors.pump ? 'Irrigando agora' : 'Em espera'} tone={sensors.pump ? 'green' : 'slate'} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="overflow-hidden border-primary/15 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-card pb-5">
              <div><CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-primary" /> Controle da bomba</CardTitle><p className="mt-1 text-xs text-muted-foreground">Envie comandos diretamente para o ESP32</p></div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone}`}>{status}</span>
            </CardHeader>
            <CardContent className="grid gap-7 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><p className="font-serif text-2xl">A umidade está em <span className="text-primary">{sensors.soil}%</span></p><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">A bomba pode ser acionada manualmente a qualquer momento. O modo automático respeita a faixa configurada ao lado.</p><div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Radio className="h-3.5 w-3.5" /> {lastEvent}</div></div>
              <div className="flex flex-col gap-2 sm:min-w-[168px]"><Button size="lg" className="h-12 bg-primary text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5" onClick={() => publishPump(true)} disabled={sensors.pump}><ToggleRight className="h-5 w-5" /> Ligar bomba</Button><Button size="lg" variant="outline" className="h-12 border-primary/25 bg-background transition-transform hover:-translate-y-0.5" onClick={() => publishPump(false)} disabled={!sensors.pump}><ToggleLeft className="h-5 w-5" /> Desligar</Button></div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border/60 pb-5"><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4 text-primary" /> Faixa de umidade</CardTitle><p className="mt-1 text-xs text-muted-foreground">Defina quando a automação deve agir</p></CardHeader>
            <CardContent className="space-y-5 p-6">
              <ThresholdField label="Umidade mínima" value={minMoisture} onChange={setMinMoisture} helper="Liga abaixo deste nível" />
              <ThresholdField label="Umidade máxima" value={maxMoisture} onChange={setMaxMoisture} helper="Desliga acima deste nível" />
              <Button onClick={saveThresholds} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saved ? 'Configuração salva' : 'Salvar configuração'}</Button>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]" aria-label="Histórico dos sensores">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between border-b border-border/60 pb-5">
              <div><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> Histórico dos sensores</CardTitle><p className="mt-1 text-xs text-muted-foreground">Leituras recentes da estação · últimas 6 horas</p></div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Tempo real</span>
            </CardHeader>
            <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
              <SensorChart title="Umidade do solo" value={`${sensors.soil}%`} color="primary" points="8,76 42,68 76,72 110,52 144,58 178,40 212,46 246,28" suffix="%" />
              <SensorChart title="Reservatório" value={`${sensors.reservoir}%`} color="amber" points="8,52 42,48 76,50 110,43 144,38 178,40 212,31 246,34" suffix="%" />
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border/60 pb-5"><CardTitle className="flex items-center gap-2 text-base"><BatteryCharging className="h-4 w-4 text-primary" /> Saúde da estação</CardTitle><p className="mt-1 text-xs text-muted-foreground">Tensão da bateria nas últimas horas</p></CardHeader>
            <CardContent className="p-6"><SensorChart title="Tensão da bateria" value={`${sensors.battery.toFixed(1)} V`} color="blue" points="8,58 42,54 76,56 110,42 144,46 178,34 212,38 246,25" suffix="V" compact /><div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-xs"><span className="text-muted-foreground">Energia solar</span><span className="flex items-center gap-1.5 font-semibold text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Operacional</span></div></CardContent>
          </Card>
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t border-border/60 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2"><Wifi className="h-3.5 w-3.5 text-primary" /> Canal: <span className="font-mono text-foreground">irrigasense/sensors/#</span></p><p className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-accent-foreground" /> Atualização em tempo real via MQTT.js</p></footer>
      </main>
    </div>
  )
}

function MetricCard({ icon, label, value, hint, progress, tone }: { icon: React.ReactNode; label: string; value: string; hint: string; progress?: number; tone: 'green' | 'amber' | 'blue' | 'slate' }) {
  const tones = { green: 'bg-primary/10 text-primary', amber: 'bg-accent text-accent-foreground', blue: 'bg-sky-100 text-sky-700', slate: 'bg-muted text-muted-foreground' }
  const bars = { green: 'bg-primary', amber: 'bg-amber-500', blue: 'bg-sky-600', slate: 'bg-muted-foreground' }
  return <Card className="border-border/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5"><div className="flex items-start justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</div>{progress !== undefined && <span className="font-mono text-[11px] text-muted-foreground">{Math.round(progress)}%</span>}</div><p className="mt-5 text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p>{progress !== undefined && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${bars[tone]} transition-all duration-500`} style={{ width: `${Math.min(progress, 100)}%` }} /></div>}</CardContent></Card>
}

function ThresholdField({ label, value, onChange, helper }: { label: string; value: string; onChange: (value: string) => void; helper: string }) {
  return <div className="space-y-2"><Label className="text-xs font-semibold">{label}</Label><div className="relative"><Input type="number" min="0" max="100" value={value} onChange={event => onChange(event.target.value)} className="h-11 pr-9 font-mono" /><span className="absolute right-3 top-3 text-sm text-muted-foreground">%</span></div><p className="text-[11px] text-muted-foreground">{helper}</p></div>
}

function SensorChart({ title, value, color, points, suffix, compact = false }: { title: string; value: string; color: 'primary' | 'amber' | 'blue'; points: string; suffix: string; compact?: boolean }) {
  const colors = { primary: 'text-primary', amber: 'text-amber-600', blue: 'text-sky-700' }
  const strokes = { primary: 'var(--primary)', amber: 'oklch(0.68 0.16 75)', blue: 'oklch(0.58 0.14 230)' }
  return <div className={compact ? '' : 'min-w-0'}><div className="mb-3 flex items-end justify-between"><div><p className="text-xs text-muted-foreground">{title}</p><p className={`mt-1 font-mono text-xl font-semibold ${colors[color]}`}>{value}</p></div><span className="text-[10px] text-muted-foreground">{suffix}</span></div><svg viewBox="0 0 254 86" className="h-24 w-full overflow-visible" role="img" aria-label={`Gráfico de ${title}`}><path d="M8 78H246 M8 48H246 M8 18H246" stroke="currentColor" strokeOpacity=".1" strokeDasharray="3 4" /><polyline points={points} fill="none" stroke={strokes[color]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx={points.split(' ')[points.split(' ').length - 1]?.split(',')[0]} cy={points.split(' ')[points.split(' ').length - 1]?.split(',')[1]} r="4" fill={strokes[color]} /></svg><div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>06:00</span><span>09:00</span><span>12:00</span></div></div>
}
