"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/app/services/auth.service";
import { getUserById } from "@/app/services/user.service";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await login(email.trim(), password);

      if (!res.user || !res.session) {
        throw new Error("Login failed: No user or session returned.");
      }

      router.refresh(); // Force a refresh to update session state for middleware

      // Ambil profile user
      const user = await getUserById(res.user.id); // Supabase user ID is res.user.id

      if (!user) {
        throw new Error("Data user tidak ditemukan di database");
      }

      // Redirect berdasarkan role
      if (user.role === "admin") {
        router.push("/dashboard/admin");
      } else {
        router.push("/dashboard/staff");
      }
    } catch (err: any) {
      console.error("LOGIN ERROR:", err);

      let errorMessage = "Terjadi kesalahan saat login";

      // Supabase Auth errors typically come as objects with a 'message' property
      if (err.message) {
        // Specific Supabase Auth errors
        if (err.message.includes("Invalid login credentials")) {
          errorMessage = "Email atau password tidak valid";
        } else if (err.message.includes("Email not confirmed")) {
          errorMessage = "Email belum dikonfirmasi. Silakan cek email Anda.";
        } else if (err.message.includes("User not found")) {
          // Though often covered by invalid credentials
          errorMessage = "Akun tidak ditemukan";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-[380px]">
      <CardHeader className="text-center">
        <Image
          src="/Logo.svg"
          alt="Sembako 32 Logo"
          width={120}
          height={120}
          className="mx-auto mb-4"
        />
        <CardTitle className="text-2xl font-bold">Login ke Akun Anda</CardTitle>
        <p className="text-muted-foreground text-sm">
          Masukkan email & password Anda untuk melanjutkan
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@gudang.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Memproses..." : "Login"}
          </Button>

          {/* <p className="text-sm text-center text-muted-foreground">
            Belum punya akun?{" "}
            <a href="/auth/register" className="text-blue-600 hover:underline">
              Daftar
            </a>
          </p> */}
        </form>
      </CardContent>
    </Card>
  );
}
