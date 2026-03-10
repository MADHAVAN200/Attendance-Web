import React from "react";

export default function MotionSection({ children, className = "", id, ...props }) {
    return (
        <section
            id={id}
            className={className}
            {...props}
        >
            {children}
        </section>
    );
}
