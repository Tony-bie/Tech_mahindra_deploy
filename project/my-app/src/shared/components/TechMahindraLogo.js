/**
 * Tech Mahindra logo SVG component.
 * dark prop = true → "TECH" text is white (for dark sidebar background).
 */
export default function TechMahindraLogo({ width = 140, dark = false }) {
    const techColor    = dark ? '#FFFFFF' : '#3D3835';
    const mahindraColor = '#E31837';

    return (
        <svg
            width={width}
            viewBox="0 0 280 90"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Tech Mahindra"
        >
            {/* ── Red parallelogram shape ── */}
            <polygon
                points="10,80 38,10 72,10 44,80"
                fill={mahindraColor}
            />
            <polygon
                points="50,80 78,10 90,10 62,80"
                fill={mahindraColor}
                opacity="0.55"
            />

            {/* ── TECH ── */}
            <text
                x="108"
                y="46"
                fontFamily="'Arial Black', 'Arial', sans-serif"
                fontWeight="900"
                fontSize="34"
                letterSpacing="1"
                fill={techColor}
            >
                TECH
            </text>

            {/* ── mahindra ── */}
            <text
                x="108"
                y="78"
                fontFamily="'Arial', sans-serif"
                fontWeight="700"
                fontSize="28"
                letterSpacing="0.5"
                fill={mahindraColor}
            >
                mahindra
            </text>
        </svg>
    );
}
