import sys
from PIL import Image
import collections

def process():
    img_path = "public/logo.png"
    img = Image.open(img_path).convert("RGBA")
    w, h = img.size
    
    # Let's crop to the right half where the text usually is to find the dominant text color
    right_half = img.crop((w//2, 0, w, h))
    colors = right_half.getcolors(maxcolors=100000)
    
    # Filter out transparent or very low alpha
    solid_colors = [c for c in colors if c[1][3] > 200]
    # Sort by frequency
    solid_colors.sort(key=lambda x: x[0], reverse=True)
    
    # Skip white/black/gray backgrounds if they exist
    def is_bg(color):
        r, g, b, _ = color
        # if very bright or very dark, might be bg
        if r > 240 and g > 240 and b > 240: return True
        if r < 15 and g < 15 and b < 15: return True
        return False
        
    text_color = None
    for count, color in solid_colors:
        if not is_bg(color):
            text_color = color
            break
            
    if not text_color:
        print("Could not find text color")
        return
        
    print(f"Detected text color: {text_color}")
    
    # Target purple: #818cf8 -> 129, 140, 248
    target_r, target_g, target_b = 129, 140, 248
    orig_r, orig_g, orig_b, _ = text_color
    
    pixels = img.load()
    
    # We want to replace colors that are close to text_color.
    # To handle anti-aliasing, we can calculate the distance to the text color.
    # If it's close, we blend it towards the target purple.
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # distance to original text color
                dist = ((r - orig_r)**2 + (g - orig_g)**2 + (b - orig_b)**2)**0.5
                
                # if it's exactly the color or very close
                if dist < 60:
                    # calculate an interpolation factor based on distance
                    # dist=0 -> 1.0 (full target), dist=60 -> 0.0 (full original)
                    factor = 1.0 - (dist / 60.0)
                    
                    new_r = int(r + (target_r - orig_r) * factor)
                    new_g = int(g + (target_g - orig_g) * factor)
                    new_b = int(b + (target_b - orig_b) * factor)
                    
                    # clamp
                    new_r = max(0, min(255, new_r))
                    new_g = max(0, min(255, new_g))
                    new_b = max(0, min(255, new_b))
                    
                    pixels[x, y] = (new_r, new_g, new_b, a)
                    
    img.save("public/logo.png")
    print("Done recoloring")

if __name__ == "__main__":
    process()
