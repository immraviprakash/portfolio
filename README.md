# Cyberpunk Portfolio – Ravi Prakash

A cyberpunk-themed interactive portfolio featuring stunning WebGL visuals, audio-reactive particle systems, and lightweight Single Page Application (SPA) style navigation.

## Features

- **Cyberpunk UI Design**: Neon accents, dark thematic styling, and micro-animations.
- **WebGL Shader Background**: Fully interactive, smoothly scaling shader canvas.
- **Particle System Engine**: Audio-reactive floating neon orbs synced to canvas.
- **SPA-Style Navigation**: Instant seamless panel transitions without white flashes.
- **Interactive Terminal**: An integrated mini-command-line interface.
- **Performance Modes**: Built-in autotuned visual presets (Max / Balanced / Low) that scale dynamically based on device memory and capability.

## Project Structure

```text
portfolio/
├── stud.html
├── projects.html
├── skills.html
├── contact.html
├── css/
│   ├── stud.css
│   ├── projects.css
│   ├── skills.css
│   └── contact.css
├── js/
│   ├── stud.js
│   ├── projects.js
│   ├── skills.js
│   └── contact.js
```

## How to Run Locally

Because the project relies on SPA `fetch` navigation between HTML pages, it requires a local web server to run properly. 

Using Python 3, run the following command in the root of the project directory:

```bash
python -m http.server 8000
```

Then, open your web browser and navigate to:
`http://localhost:8000/stud.html`

## Technologies Used

- **HTML5**
- **CSS3** (CSS Variables, keyframe animations)
- **JavaScript** (Modern ES6 syntax, Fetch API)
- **WebGL** (GLSL shaders)

## Author

**Ravi Prakash**  
B.E. Computer Science Engineering
