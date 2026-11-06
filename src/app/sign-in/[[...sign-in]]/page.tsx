"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function SignInPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: identifier, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 401
              ? "Credenciales institucionales incorrectas."
              : res.status === 403
                ? "No cuentas con acceso asignado para este sistema. Contacta a soporte."
                : "No se pudo iniciar sesión. Intenta nuevamente."),
        );
      }

      window.location.href = data.redirectUrl || "/teacher";
    } catch (err: unknown) {
      setLoading(false);
      setError(
        err instanceof Error ? err.message : "Error inesperado al ingresar.",
      );
    }
  }

  return (
    <main className="flex h-screen items-center justify-center overflow-hidden bg-background p-3 text-foreground md:p-6">
      <section className="grid h-full max-h-[620px] w-full max-w-5xl overflow-hidden rounded-lg border bg-card shadow-sm md:grid-cols-[minmax(0,1fr)_420px]">
        {/* Panel lateral con escudo e información institucional */}
        <div className="hidden min-h-0 flex-col justify-between bg-sidebar p-8 text-sidebar-foreground md:flex">
          <div className="flex items-center gap-3">
            <Image
              src="/escudo-unmsm.png"
              alt="Escudo UNMSM"
              width={56}
              height={56}
              className="rounded-md bg-vellum p-1"
              priority
            />
            <div className="min-w-0">
              <p className="text-gold text-xs font-semibold uppercase tracking-[0.18em]">
                UNMSM
              </p>
              <h1 className="truncate font-serif text-3xl font-semibold">
                Horarios FISI
              </h1>
            </div>
          </div>
          <div className="max-w-xl space-y-4">
            <p className="font-serif text-4xl leading-tight">
              Ingreso para docentes y Dirección Académica.
            </p>
            <p className="text-sidebar-foreground/75 text-sm leading-6">
              Sistema de registro y revisión de disponibilidad docente del
              semestre vigente.
            </p>
          </div>
          <p className="border-sidebar-border border-t pt-3 text-sidebar-foreground/70 text-sm">
            Facultad de Ingeniería de Sistemas e Informática
          </p>
        </div>

        {/* Formulario de Login Institucional */}
        <section className="flex min-h-0 items-center justify-center p-6 md:p-8">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="flex justify-center md:hidden mb-4">
                <Image
                  src="/escudo-unmsm.png"
                  alt="Escudo UNMSM"
                  width={48}
                  height={48}
                  className="rounded-md bg-vellum p-1"
                />
              </div>
              <h2 className="font-serif text-2xl font-bold tracking-tight">
                Iniciar Sesión
              </h2>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Ingresa con tu usuario o correo institucional (@unmsm.edu.pe) y
                tu contraseña del servidor central LDAP.
              </p>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs leading-relaxed"
              >
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-xs font-medium">
                  Usuario o Correo Institucional
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="ej. lmotaa o lmotaa@unmsm.edu.pe"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">
                  Contraseña LDAP
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full font-medium"
                disabled={loading || !identifier.trim() || !password}
              >
                {loading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Validando credenciales...
                  </>
                ) : (
                  "Ingresar al Sistema"
                )}
              </Button>
            </form>

            <div className="pt-2 text-center text-muted-foreground text-xs">
              <p>Autenticación centralizada FISI - UNMSM</p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
