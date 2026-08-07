import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Home, Loader2, MapPin } from "lucide-react"

import {
  getGetMyAttendanceQueryKey,
  useGetMyAttendance,
  useSelfCheckinAttendance,
} from "@workspace/api-client-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { formatTime, getTodayInIST } from "@/lib/utils"

export default function AttendanceSelfCheckin() {
  const selectedDate = getTodayInIST()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [locationState, setLocationState] = React.useState<"idle" | "requesting" | "denied">("idle")
  const [workLocation, setWorkLocation] = React.useState<"office" | "remote">("office")
  const { data, isLoading } = useGetMyAttendance({ date: selectedDate })
  const checkin = useSelfCheckinAttendance()
  const record = data?.[0]
  const hasLocation = record?.latitude !== null && record?.latitude !== undefined
    && record?.longitude !== null && record?.longitude !== undefined

  function requestCheckin() {
    if (!navigator.geolocation) {
      setLocationState("denied")
      toast({ title: "Location unavailable", description: "This browser does not provide location services." })
      return
    }
    setLocationState("requesting")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        checkin.mutate({
          data: {
            attendanceDate: selectedDate,
            workLocation,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          },
        }, {
          onSuccess: (created) => {
            void queryClient.invalidateQueries({ queryKey: getGetMyAttendanceQueryKey({ date: selectedDate }) })
            setLocationState("idle")
            toast({ title: "Check-in recorded", description: `Location evidence captured at ${formatTime(created.selfCheckinAt)}.` })
          },
          onError: (error) => {
            setLocationState("idle")
            toast({ title: "Check-in could not be recorded", description: error instanceof Error ? error.message : "Please try again." })
          },
        })
      },
      () => {
        setLocationState("denied")
        toast({ title: "Location permission needed", description: "Allow location access to attach evidence to your self-check-in." })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }

  if (isLoading) {
    return <Card><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading today’s check-in…</CardContent></Card>
  }

  return (
    <Card className={record?.selfCheckinAt ? "border-emerald-500/25 bg-emerald-500/[0.04]" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {record?.selfCheckinAt ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <MapPin className="h-5 w-5 text-primary" />}
          {record?.selfCheckinAt ? "Checked in today" : "Self-check in"}
        </CardTitle>
        <CardDescription>
          {record?.selfCheckinAt
            ? `${record.status === "remote" ? "Working remotely" : "Present in office"} · attendance remains recorded with location evidence at ${formatTime(record.selfCheckinAt)}.`
            : "Tell us where you are working, then capture your location to self-check in. GPS is stored as evidence and does not block remote check-in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {record?.selfCheckinAt ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <span>
                Location captured
                {record.accuracyMeters ? ` · ±${Math.round(record.accuracyMeters)} m accuracy` : ""}
              </span>
            </div>
            {hasLocation && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
                <span className="font-mono text-[11px]">
                  {record.latitude!.toFixed(6)}, {record.longitude!.toFixed(6)}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  View on map
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            <Alert>
              <Home className="h-4 w-4" />
              <AlertTitle>Choose your work location</AlertTitle>
              <AlertDescription>Select whether you are in the office or working remotely, then capture your location.</AlertDescription>
            </Alert>
            <RadioGroup value={workLocation} onValueChange={(value) => setWorkLocation(value as "office" | "remote")} className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="office" id="work-location-office" />
                <span>
                  <span className="block text-sm font-medium">In office</span>
                  <span className="block text-xs text-muted-foreground">I am working from the office</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="remote" id="work-location-remote" />
                <span>
                  <span className="block text-sm font-medium">Working remotely</span>
                  <span className="block text-xs text-muted-foreground">I am working away from the office</span>
                </span>
              </label>
            </RadioGroup>
            {locationState === "denied" && <p className="text-sm text-destructive">Location access was not available. Enable it in your browser settings and try again.</p>}
            <Button type="button" onClick={requestCheckin} disabled={locationState === "requesting" || checkin.isPending}>
              {locationState === "requesting" || checkin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
              Capture location and check in
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}