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

**Branch**: `test-new-chamfer-model` (experimental)
**Status**: Model upgrade COMPLETE, camera positioning needs refinement

The project has evolved through several approaches:
1. **Colored box with face materials** (stable face detection)
2. **TrackballControls experiment** (for free rotation)
3. **Beveled GLB model** (better visuals, complex face detection) - SOLVED
4. **New chamfered model** (improved click targeting) - COMPLETE

### Major Breakthrough (Latest Session)
**SOLVED: Edge/Corner Click Target Alignment**
- **New chamfered_cube.glb model** - Wider chamfers for better click targeting
- **Improved user experience** - Much easier to click on edges and corners
- **All 26 zones functional** - 6 main faces + 12 edge chamfers + 8 corner chamfers properly detected
- **Material index mapping maintained** - Proper mesh name to material index mapping (0-25)
- **Model compatibility layer** - Added `getMaterialIndexFromIntersection()` for future model changes

### Current Issue (Minor - Camera Positioning)
**Edge/Corner Camera Positioning**: While edges and corners are now easy to click, some clicks produce identical camera quaternions or minimal camera movement, resulting in unclear views.

**Evidence**: `Orientation changed | From: (0.37, -0.10, 0.25, 0.89) | To: (0.37, -0.10, 0.25, 0.89)` - no actual change

### Recent Commits (One-Problem-Per-Commit Philosophy)
- **f3c426e** - Fix edge and corner camera positioning with lookup table approach (MAJOR)
- **0e2447a** - Update CLAUDE.md - Document debug panel and feature positioning issues  
- **9cb594b** - Add debug panel for systematic ViewCube testing
- **6ef4008** - Switch to new chamfered_cube.glb model with improved click targeting (MAJOR)
- **17d2a5a** - Fix ViewCube face detection and camera positioning system (MAJOR)

### Development Philosophy (Updated)
**One Problem Per Commit**: Starting with next commit, we will tackle exactly one specific problem, fix it completely, commit it, then move to the next. This maintains cleaner git history and easier debugging.

**Git Commit Messages**: Do not include references to Claude Code, Claude, or Anthropic in commit messages. Keep them focused on the technical changes made.

### Current Todo List (Priority Order)
1. **Fix edge/corner camera positioning** (HIGH) - Some clicks produce identical quaternions or minimal camera movement
2. **Add corner ViewCube overlay** (MEDIUM) - 100x100px display in top-right
3. **Create reusable ViewCube component class** (LOW) - For integration into other projects
4. **Implement smooth camera transitions** (LOW) - Currently disabled, was causing testing issues

### Completed Tasks ✅
- ✅ **Fix edge/corner click target alignment** - New chamfered_cube.glb model with wider chamfers
- ✅ **Fix camera orientation issues** - All main faces work correctly with proper orthographic positioning
- ✅ **Implement full 26-zone ViewCube functionality** - All 6 faces + 12 edges + 8 corners detected
- ✅ **Fix console logging verbosity** - Now only logs on material index changes
- ✅ **Fix material index detection** - Proper mesh name to material index mapping (0-25)
- ✅ **Prevent redundant camera changes** - "Already correctly oriented" logic working
- ✅ **Create debug panel** - Left-side panel with 26 radio buttons for systematic testing

### Testing Results: Edge/Corner Camera Positioning Issues

**Terminology**: "Feature" = face, edge, or corner (general term for any of the 26 clickable zones)

**Testing revealed**:
1. **Redundant orientations** - Multiple edges/corners produce identical quaternions
   - Edge 9 clicks: `From: (0.10, 0.37, 0.23, 0.89) | To: (0.10, 0.37, 0.23, 0.89)` - no change
   - Edge 8 clicks: Both resulted in `(-0.27, -0.65, -0.27, 0.65)` - no change
2. **Debug panel uses placeholder math** - Arbitrary positions not matching ViewCube geometry
3. **Face normals approach insufficient** - Produces unclear or identical views for edges/corners
4. **Main faces work correctly** - Predefined positions and "already oriented" detection functioning

### Next Implementation: Fix Edge/Corner Camera Positioning

**Solution**:
1. **Create lookup table** - Define proper camera positions and up vectors for all 26 features
   - 6 faces: Keep existing orthographic views (working)
   - 12 edges: Define isometric views showing 2 adjacent faces
   - 8 corners: Define isometric views showing 3 adjacent faces
2. **Implement consistent checking** - Add "already correctly oriented" logic for all features
3. **Remove dynamic calculations** - Replace face normal approach with lookup table
4. **Unify positioning** - Ensure ViewCube clicks and debug panel use same positions

### 🚨 **Critical Issue Discovered - Mouse Position Mismatch**

**Status**: MAJOR BUG IDENTIFIED - Reference camera approach FAILED

**Problem**: Root cause correctly identified as camera-dependent raycasting causing cycling behavior, but attempted fix using reference camera has made the problem worse.

**Evidence from Testing**:

**Original Problem (Exhibits A-D)**:
- **Exhibit C**: Same NDC: (0.009, 0.286) cycling through materials 11→5→16→4→11... as camera rotates
- **Exhibit D**: Same NDC: (-0.099, 0.052) cycling through materials 7→1→9→5→6→4→8... as camera rotates
- **Root Cause**: Camera rotations between clicks cause same screen coordinates to detect different materials

**Failed Fix Attempt - Reference Camera**:
- **Approach**: Store initial camera state and use for all raycasting to eliminate camera movement dependency
- **Implementation**: Created `referenceCamera` with fixed position (3,3,3) and initial orientation
- **Result**: **16 out of 28 clicks now fail completely** with "No intersection detected"
- **Analysis**: Fixed camera perspective misaligned with model geometry, causing most rays to miss entirely

**Current Status**:
- Reference camera approach fundamentally flawed
- Made problem worse: cycling behavior replaced with complete detection failure
- Most clicks now produce no intersections instead of at least detecting something
- Coordinate mismatch secondary issue remains (0.089 offset in global vs event coordinates)

**Impact**: 
- ViewCube now largely non-functional with majority of clicks failing
- Users can no longer reliably interact with most areas of the ViewCube
- Reference camera fixed at initial position incompatible with model geometry

**Lessons Learned**:
1. **Camera-dependent raycasting** correctly identified as root cause of cycling behavior
2. **Reference camera approach** wrong solution - creates new problems without solving original
3. **Need alternative approach** that maintains camera-independence without breaking intersection detection
4. **Consider hybrid approach** or invisible geometry solutions mentioned in development strategy

**Status**: Back to drawing board - need fundamental rethink of click detection approach.

### Debugging Features (Active)
- **Debug Panel** - Left-side panel with "Go" button and 26 radio options for all features
  - Shows material index and mesh name for each feature
  - Triggers camera positioning via `setCameraForMaterial()` function
  - Logs source as "debug panel" for tracking
- **Synchronized timestamps** - Timer in top-right corner matches console log timestamps
- **Enhanced Click Debugging** - Comprehensive mouse interaction tracking
  - **Pointer Down**: `POINTER_DOWN | Seq: X | Screen: (x,y) | NDC: (x,y) | 3D: (x,y,z) | Material: X (Name) | Mesh: Name | Distance: X`
  - **Pointer Up**: `POINTER_UP | Seq: X | Duration: Xms | Screen: (x,y) | NDC: (x,y) | 3D: (x,y,z) | Material: X (Name) | Mesh: Name`
  - **Click Events**: `CLICK | Seq: X | Face: X | Material: X (Name) | Mesh: Name | 3D: (x,y,z) | Normal: (x,y,z) | Distance: X`
  - **Failed Clicks**: `CLICK | Seq: X | No intersection detected | Mouse: (x,y) | Ray origin: (x,y,z)`
  - **Sequence ID**: Each click sequence gets unique ID for correlation
- **Comprehensive event logging**:
  - Zoom changes: `Zoom changed | From: X | To: Y`
  - Pan changes: `Pan changed | From: (x,y,z) | To: (x,y,z)`
  - Orientation changes: `Orientation changed | From: (qx,qy,qz,qw) | To: (qx,qy,qz,qw) | Source: view cube/mouse drag/debug panel`
  - Hover events: `Hovered material index: X (MaterialName), Mesh: MeshName`
  - Redundant clicks: `Feature Y (MaterialName) already correctly oriented - no change needed`
  - Debug panel actions: `Debug panel: Triggering camera position for material X (MaterialName)`

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
  - Material indices 0-5: Main faces (Red, Green, Blue, Yellow, Magenta, Cyan)
  - Material indices 6-17: Edge chamfers (12 edges)
  - Material indices 18-25: Corner chamfers (8 corners)
- Attempted to use geometry groups for face identification
- Debug logging revealed complex mesh structure without clear group definitions
- Subdivision experiments (5, 25, 50 cuts) to optimize face grouping

### Phase 4: Material Index Mapping Solution (commit 17d2a5a)
- **Breakthrough discovery**: GLB contains 26 separate meshes (Cube001, Cube001_1, ..., Cube001_25)
- Each mesh has only 1 material and 1-2 faces, explaining the face.materialIndex=0 issue
- **Solution**: Map mesh names to material indices instead of relying on face.materialIndex
- **Key functions**: `getMaterialIndexFromMesh()` and `getMaterialInfo()` 
- **Fixed face normals**: Corrected Blue/Yellow camera position mapping (were swapped)
- **Redundant click prevention**: Check camera position before applying changes

### Phase 5: New Chamfered Model Implementation (commit 6ef4008)
- **New model**: `chamfered_cube.glb` with wider chamfers for better click targeting
- **Model compatibility**: Added `getMaterialIndexFromIntersection()` for future model changes
- **Click targeting improvement**: Wider chamfers make edges and corners much easier to click
- **All 26 zones maintained**: 6 main faces + 12 edge chamfers + 8 corner chamfers
- **User experience enhancement**: No more "click beyond" issues for edge/corner targeting

## Architecture

### Current Implementation (src/main.js)
- Three.js scene with PerspectiveCamera
- TrackballControls for unlimited rotation capability
- GLTFLoader for chamfered cube model (26 separate meshes)
- Raycasting for face detection with mesh name mapping
- Click-to-orient camera functionality with redundant click prevention
- Material index mapping system: `getMaterialIndexFromMesh()`, `getMaterialIndexFromIntersection()`, and `getMaterialInfo()`

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
- `public/chamfered_cube.glb` - Current 3D model (new, improved chamfer width)
- `public/beveled_cube_chamfered.glb` - Previous 3D model (still available)
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