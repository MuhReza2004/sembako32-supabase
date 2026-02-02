"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { register } from "@/app/services/auth.service";


export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    const res = await register(email, password);

    if (!res.user) {
      throw new Error("Registration failed: No user returned.");
    }
    


    router.push("/auth/login");
  };

  return (
    <Card className="w-[380px]">
      <CardHeader>Register Gudang</CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button onClick={handleRegister} className="w-full">
          Daftar
        </Button>
      </CardContent>
    </Card>
  );
}
