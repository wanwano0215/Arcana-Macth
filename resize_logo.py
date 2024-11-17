from PIL import Image

def resize_logo():
    # Open the source image
    source_path = 'u3678478888_logo_with_the_text_Arcana_Matchtarot_cards_styles_a442316f-3d79-471d-8d23-fcb92d28e372_0.png'
    target_path = 'static/images/arcana_match_logo.png'
    
    # Open and resize the image
    with Image.open(source_path) as img:
        # Calculate new height to maintain aspect ratio
        target_width = 400
        width_percent = (target_width / float(img.size[0]))
        target_height = int((float(img.size[1]) * float(width_percent)))
        
        # Resize image
        resized_img = img.resize((target_width, target_height), Image.LANCZOS)
        
        # Save the resized image
        resized_img.save(target_path, 'PNG', quality=95)

if __name__ == '__main__':
    resize_logo()
