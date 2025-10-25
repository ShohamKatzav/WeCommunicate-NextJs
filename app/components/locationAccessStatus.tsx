"use client";
import { useEffect, useState } from "react";

const LocationAccessInformation = ({ information }: { information: string }) => {
    const [headerText, setHeaderText] = useState("");

    useEffect(() => {
        const text =
            information === "prompt"
                ? "We're waiting for you to grant access to your location"
                : "Access to location service denied";
        setHeaderText(text);
    }, [information]);

    return (
        <div className="grid md:grid-cols-3 min-h-[70vh] place-items-center px-6 py-12">
            <div className="md:col-start-2 space-y-8 text-center">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-lime-500 to-cyan-800">
                    {headerText}
                </h1>

                <p className="text-lg md:text-xl text-gray-800 dark:text-gray-200 max-w-xl mx-auto">
                    To use one of our newest features - sharing and viewing your friends&apos; locations - please allow access to location services in your browser settings.
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 shadow-md space-y-4">
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Learn how to enable location access:
                    </p>
                    <ul className="space-y-3 text-lg">
                        <li>
                            <a
                                href="https://support.google.com/chrome/answer/142065?hl=en"
                                className="font-medium text-blue-600 underline dark:text-blue-400 hover:no-underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Google Chrome – Location sharing guide
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://support.microsoft.com/en-gb/microsoft-edge/location-and-privacy-in-microsoft-edge-31b5d154-0b1b-90ef-e389-7c7d4ffe7b04"
                                className="font-medium text-blue-600 underline dark:text-blue-400 hover:no-underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Microsoft Edge – Location & privacy guide
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default LocationAccessInformation;