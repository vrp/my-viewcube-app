# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Three.js ViewCube implementation project aimed at creating a reusable component for 3D model viewer applications. The ViewCube provides intuitive camera navigation by clicking on cube faces, edges, and corners (similar to CAD software).

## Development Commands

This project uses **bun** (not npm/node):
- `bun install` - Install dependencies
- `bun run dev` - Start development server (Vite)
- `bun run build` - Build for production
- `bun run preview` - Preview production build

## Current State & Challenges

**Branch**: `beveled_cube` (experimental)
**Main Issue**: Face detection difficulties with beveled GLB model

The project has evolved through several approaches:
1. **Colored box with face materials** (stable face detection)
2. **TrackballControls experiment** (for free rotation)
3. **Beveled GLB model** (better visuals, but complex face detection)

Recent commits show experimentation with subdivision levels (5, 25, 50 cuts) to improve face grouping, but this approach hasn't yielded stable results.

### Latest Updates
**Previous multi-change commit:**
- Fixed face mapping - Corrected material index to color mapping based on actual GLB data
- Added face identification display - Shows which material index/color is currently pointing up
- Reverted to snap behavior - Disabled smooth animations for testing focus
- Fixed material index checking - Only main faces (0-5) get cardinal positioning logic
- Restored TrackballControls - Unlimited rotation capability
- Timer display - For debugging and development

**Recent focused commits (one-problem-per-commit):**
- **Fixed console logging** - All debug output now uses synchronized timestamps
- **Added comprehensive event logging** - Restored zoom, pan, and orientation change tracking with detailed state transitions

### Development Philosophy (Updated)
**One Problem Per Commit**: Starting with next commit, we will tackle exactly one specific problem, fix it completely, commit it, then move to the next. This maintains cleaner git history and easier debugging.

**Git Commit Messages**: Do not include references to Claude Code, Claude, or Anthropic in commit messages. Keep them focused on the technical changes made.

### Current Todo List (Priority Order)
1. **Fix camera orientation issues** (HIGH) - Multiple problems identified during testing
2. **Implement full 26-zone ViewCube functionality** (HIGH) - 6 faces + 12 edges + 8 corners
3. **Add corner ViewCube overlay** (MEDIUM) - 100x100px display in top-right
4. **Fix console logging verbosity** (MEDIUM) - Only log on hover change
5. **Create reusable ViewCube component class** (LOW) - For integration into other projects
6. **Implement smooth camera transitions** (LOW) - Currently disabled, was causing testing issues

### Known Issues (Current Testing Observations)
- Camera orientation behavior has "many problems" per user testing
- Face normal calculations may need refinement
- Edge/corner chamfer colors too similar for human testing (all orange/purple gradients)

### Debugging Features (Active)
- **Synchronized timestamps** - On-screen timer matches console log timestamps for screenshot correlation
- **Comprehensive event logging**:
  - Zoom changes: `Zoom changed | From: X | To: Y`
  - Pan changes: `Pan changed | From: (x,y,z) | To: (x,y,z)`
  - Orientation changes: `Orientation changed | From: (qx,qy,qz,qw) | To: (qx,qy,qz,qw) | Source: view cube/mouse drag`
  - Hover events: `Hovered face index: X`
  - Click events: `Clicked face index: X, Material index: Y`
- **Face identification display** - Shows which material/color is currently pointing up

## Detailed Implementation History

### Phase 1: Colored Box Implementation (up to commit 7dd9346)
- Used `BoxGeometry` with 6 different colored materials (red, green, blue, yellow, cyan, magenta)
- Implemented corner ViewCube overlay (100x100px, top-right)
- Face detection via `materialIndex` (0-5)
- ViewCube rotation synchronized with main camera: `viewCube.quaternion.copy(camera.quaternion).invert()`
- Used scissor test for rendering ViewCube in corner

### Phase 2: TrackballControls & Orthographic Alignment (commits 770d4dc - 0939ad1)
- Switched from OrbitControls to TrackballControls for unrestricted rotation
- Added proper `camera.up` vectors for each face:
  - Top/Bottom faces: special up vectors (0,0,-1) and (0,0,1)
  - Side faces: standard up vector (0,1,0)
- Enhanced camera positioning for true orthographic views

### Phase 3: GLB Model Integration (commit f59b409 onwards)
- Beveled cube model supports 26 clickable zones:
  - Material indices 0-5: Main faces
  - Material indices 6-17: Edge chamfers
  - Material indices 18-25: Corner chamfers
- Attempted to use geometry groups for face identification
- Debug logging revealed complex mesh structure without clear group definitions
- Subdivision experiments (5, 25, 50 cuts) to optimize face grouping

## Architecture

### Current Implementation (src/main.js)
- Three.js scene with PerspectiveCamera
- OrbitControls for user interaction
- GLTFLoader for beveled cube model
- Raycasting for face detection
- Click-to-orient camera functionality

### Key Technical Decisions
- Moved from colored box geometry to GLB model for better aesthetics
- Experimented with both OrbitControls and TrackballControls
- Added extensive event logging for debugging

## Development Strategy

### Recommended Approach: Hybrid Solution
1. Use invisible box geometry for reliable face/edge/corner detection
2. Display beveled GLB model for visual appeal
3. Map box intersections to camera positions

### Component Structure Goals
- Self-contained ViewCube class using vanilla JavaScript (no React/Vue)
- Configurable size, position, and styling
- Event callbacks for integration
- Independent scene/camera/renderer for overlay display
- Clean ES6 modules, leveraging Vite's build capabilities

## Important Files

- `src/main.js` - Main application logic
- `public/beveled_cube_chamfered.glb` - Current 3D model
- Previous commits contain colored box implementation worth referencing

## Key Working Implementations

### Colored Box ViewCube (commit 7dd9346)
```javascript
// Corner ViewCube with reliable face detection
const viewCube = new THREE.Mesh(
  new THREE.BoxGeometry(),
  [/* 6 colored materials */]
);
// Face click handling
switch (faceIndex) {
  case 0: camera.position.set(3, 0, 0); break;
  // ... other faces
}
```

### TrackballControls Camera Positioning (commit 0939ad1)
```javascript
// Proper camera alignment for orthographic views
case 2: // Top face
  camera.position.set(0, 3, 0);
  camera.up.set(0, 0, -1); // Special up vector
  break;
```

## Testing Approach

Currently no test framework. When implementing:
- Test face detection accuracy
- Verify camera positioning for all 26 views (6 faces + 12 edges + 8 corners)
- Ensure component isolation doesn't affect main scene

## Known Working Commits

- `7dd9346` - Colored box with stable face detection
- `d9de63d` - Before beveled cube experiments began

## Next Steps

Build a production-ready ViewCube component that combines the visual appeal of the beveled model with the interaction reliability of the box geometry approach. The component should be easily integrated into any Three.js project as a drop-in solution.