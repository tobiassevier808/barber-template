# GJ Fadezz Barber Shop Website

A custom-coded HTML/CSS barber shop website, replicated from the original Square-built site at gjfadezz.com.

## Features

- **Responsive Design**: Mobile-friendly layout that works on all devices
- **Minimal Black Theme**: Dark, professional design matching the original Square site
- **Sections Included**:
  - Homepage with hero banner (matching original text)
  - Services list with booking buttons
  - Contact form and information
- **Navigation**: Sticky navbar with mobile hamburger menu
- **Inter Font**: Uses Google Fonts Inter (matching original)

## File Structure

```
gj-fadezz-website/
├── index.html          # Main HTML file
├── css/
│   └── styles.css     # All styles (matches original design)
├── js/
│   └── script.js      # JavaScript functionality
├── assets/            # Images folder (add your images here)
└── README.md          # This file
```

## Setup

1. **Add Hero Banner Image**:
   - The hero banner image should be named `hero-banner.jpg` and placed in the `assets/` folder
   - Original image: `IMG_2805_1760834993.jpeg` from the Square site
   - You can download it from the original site or use your own image

2. **Update Service Information**:
   - The site currently has 3 placeholder service cards
   - Update each service card in `index.html` with:
     - Service name (e.g., "Haircut", "Beard Trim", etc.)
     - Service description
     - Duration (e.g., "30 min", "45 min")
     - Price (e.g., "$25", "$30")
   - Add or remove service cards as needed

3. **Update Contact Information**:
   - Update address, hours, and phone number in the contact section
   - The contact form is functional but will need backend integration for actual submission

4. **Open the site**:
   - Open `index.html` in your web browser to view the site

## Design Details (Matching Original)

- **Primary Color**: #212121 (dark gray/black)
- **Secondary Color**: #141414 (darker gray)
- **Background**: #eeeeee (light gray for sections)
- **Font**: Inter (400 weight for body, 500 for titles)
- **Button Style**: Squared (no border radius)
- **Image Border Radius**: 16px

## Customization

- **Colors**: Edit CSS variables in `css/styles.css` (`:root` section)
- **Content**: Update text content in `index.html`
- **Images**: Replace images in the `assets` folder
- **Services**: Modify service cards in the services section

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## Notes

- The hero banner text matches the original Square site exactly
- Service information needs to be added (currently placeholders)
- The original site uses Square's appointment booking system - you'll need to implement your own booking solution or link to an external booking platform
- Instagram link is set to @gj.fadezz (matching original)
