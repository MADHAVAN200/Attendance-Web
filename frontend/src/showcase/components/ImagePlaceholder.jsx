export default function ImagePlaceholder({ title = "Image Placeholder", ratio = "wide" }) {
    return (
        <div className={`image-placeholder image-${ratio}`}>
            <div className="image-sheen" />
            <p>{title}</p>
        </div>
    );
}
