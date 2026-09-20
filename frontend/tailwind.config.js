export default {
    content: [
        './index.html',
        './src/**/*.{js,jsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
            },
            colors: {
                primary: {
                    DEFAULT: '#4f46e5',
                    dark: '#4338ca',
                    light: '#e0e7ff',
                    muted: '#eef2ff',
                },
            },
        },
    },
    plugins: [],
};
