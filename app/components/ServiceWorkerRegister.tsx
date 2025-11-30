"use client";

import { useEffect } from "react";
import registerSW from "../utils/registerSW";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        registerSW();
    }, []);

    return null;
}