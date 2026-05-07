import assert from 'assert';
import { selectVisibleHotspots } from '../selectVisibleHotspots.js';

function runTests() {
    console.log("Running selectVisibleHotspots tests...");

    const initialView = "uploads/pontos/initial.jpg";
    const otherView = "uploads/pontos/other.jpg";

    const allHotspots = [
        { id_hotspot: 1, view_path: null }, // Global hotspot
        { id_hotspot: 2, view_path: "" }, // Global hotspot
        { id_hotspot: 3, view_path: initialView }, // Initial view hotspot
        { id_hotspot: 4, view_path: otherView }, // Other view hotspot
    ];

    // Case 1: At root view (currentView is empty, initialView is set)
    // Global hotspots (1, 2) and hotspots for initialView (3) should be visible
    let visible = selectVisibleHotspots(allHotspots, "", initialView);
    assert.deepEqual(visible.map(h => h.id_hotspot), [1, 2, 3], "Root view should show global and initial view hotspots");

    // Case 2: At root view (currentView matches initialView)
    visible = selectVisibleHotspots(allHotspots, initialView, initialView);
    assert.deepEqual(visible.map(h => h.id_hotspot), [1, 2, 3], "Current matches initial view should show global and initial view hotspots");

    // Case 3: At other view (currentView matches otherView)
    // Global hotspots should NOT be visible. Only otherView hotspots.
    visible = selectVisibleHotspots(allHotspots, otherView, initialView);
    assert.deepEqual(visible.map(h => h.id_hotspot), [4], "Other view should only show hotspots for that view");

    // Case 4: At unknown view (currentView is something else)
    visible = selectVisibleHotspots(allHotspots, "uploads/pontos/unknown.jpg", initialView);
    assert.deepEqual(visible.map(h => h.id_hotspot), [], "Unknown view should show no hotspots");

    // Case 5: Undefined / Null edge cases
    visible = selectVisibleHotspots(null, "", "");
    assert.deepEqual(visible, [], "Null array should return empty array");

    console.log("All selectVisibleHotspots tests passed!");
}

runTests();
