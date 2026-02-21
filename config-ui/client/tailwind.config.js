/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // "ICCC" Dark Theme
                background: '#0f172a', // Slate 900
                surface: '#1e293b',    // Slate 800
                primary: '#3b82f6',    // Blue 500
                accent: '#f59e0b',     // Amber 500
                success: '#22c55e',    // Green 500
                error: '#ef4444',      // Red 500
            }
        },
    },
    plugins: [],
}
