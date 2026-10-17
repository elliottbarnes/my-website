// Original fan episode. Story state is deterministic; input and rendering live elsewhere.
(() => {
  "use strict";

  const objective = "release the spillway safely and keep the village below dry";
  const option = (command, label, detail) => ({ command, label, detail });

  function freeze(state) {
    Object.freeze(state.choices);
    for (const entry of state.trail) {
      Object.freeze(entry.response);
      Object.freeze(entry);
    }
    Object.freeze(state.trail);
    return Object.freeze(state);
  }

  function create() {
    return freeze({ node: "arrival", revision: 0, choices: { approach: null, method: null, resolution: null }, trail: [] });
  }

  function normalize(raw) {
    if (typeof raw !== "string" || raw.length > 64) return "";
    return raw.trim().toLowerCase().replace(/^[:/]/, "").trim();
  }

  function view(state) {
    const { approach, method, resolution } = state.choices;
    const scene = { id: state.node, title: "", paragraphs: [], choices: [], objective, decision: 0, complete: false, summary: [] };
    switch (state.node) {
      case "arrival":
        scene.title = "the quiet current";
        scene.paragraphs = [
          "Goku is following the smell of steamed rice when the valley bell starts ringing. Below the mountain reservoir, people carry bedding and cooking pots uphill. A little girl refuses to leave without the flour sack from her family's noodle shop. Goku lands beside her, hoists the sack, and carries it to the waiting cart.",
          "At the spillway, water hammers a gate that should be open. A slab of fallen rock has wedged beneath it. Bulma is already there, balancing a Capsule Corp scanner on a fence post. She points past the gate to the roofs downstream. \"Break that open all at once and the whole reservoir goes through their kitchens. We need a small, steady release.\"",
          "Goku crouches beside the shuddering machinery. \"So lifting it isn't the hard part. It's keeping the water where we want it.\" He grins at the puzzle, then checks that everyone is clear. The strength is there. How he uses it is up to you.",
        ];
        scene.choices = [option("begin", "begin", "inspect the spillway; nothing moves until you choose")];
        break;
      case "banks":
        scene.title = "before the release";
        scene.decision = 1;
        scene.paragraphs = [
          "The gate leans in its runners. Every surge pushes the left support farther out of line. Beside it, a narrow relief channel is packed with branches and gravel. Bulma marks a safe water level on the concrete with chalk. \"Either preparation buys us a controlled attempt. We can't leave the outlet unattended once we start.\"",
          "You could brace the gate with the fallen support beam. That would keep its runners straight for a careful lift, but the reservoir would still be pushing hard behind it. Goku tests the beam with two fingers; it is sound enough to hold. He can place it without striking the trapped rock.",
          "Or you could clear the relief channel. The water would drain away from the houses and take pressure off the jam, making a small ki pulse easier to contain. The gate's bent support would remain unsupported. Neither job needs more strength. They prepare different ways through the same problem, and the next surge is close enough that Goku must commit to one before tending the outlet.",
        ];
        scene.choices = [
          option("hold", "brace the gate", "protect its runners for a lift; water pressure stays high"),
          option("drain", "clear the relief channel", "reduce pressure for a pulse; the gate stays unsupported"),
        ];
        break;
      case "aftermath":
        scene.title = approach === "hold" ? "a steady frame" : "room for the river";
        scene.decision = 1;
        scene.paragraphs = approach === "hold" ? [
          "Goku lowers the beam into the empty support sockets. Rather than hammering it home, he presses until the wood settles with a single creak. The left runner stops twisting. He takes his hands away slowly; the brace holds. Behind the gate, the water still pounds hard enough to shake dust from the railing.",
          "Bulma draws a second chalk line across the straightened frame. \"That should keep the gate aligned when you lift it. The pressure hasn't dropped, though. If you use a blast, you'll need to know exactly where to put it.\" Goku watches a drop of water dance on the beam. \"Even a little push can go a long way here.\"",
          "Downstream, the noodle-shop owner settles his daughter onto the cart beside her rescued flour. He asks whether to keep moving. Goku calls back that they should stay on high ground until the bell sounds again. The brace has made one part of the job safer. It has not opened the gate, and he isn't ready to promise that the work is over.",
        ] : [
          "Goku lifts the tangled branches out together, then scoops gravel from the relief channel with his hands. Water curls into the cleared ditch and follows the stone-lined route around the village. The mark on the reservoir wall begins to emerge. He sets the branches well above the bank so they cannot wash straight back in.",
          "Bulma checks the falling water level against her scanner. \"Less pressure on the rock. A small pulse should be easier to contain now. But look at that runner.\" The left side of the gate still leans away from its support. A hard lift could twist it. Goku peers along the metal edge. \"Then I'd better learn when it stops pulling.\"",
          "The noodle-shop owner sees water in the side channel and starts to climb off the cart. Goku waves him back uphill: this route is safe, but the main outlet is still blocked. His daughter holds the flour sack like a passenger. Clearing the ditch has given Goku room to work. The damaged gate still needs a deliberate release.",
        ];
        scene.choices = [option("continue", "inspect the jam", "find a controlled way to release it")];
        break;
      case "survey":
        scene.title = "learn before pushing";
        scene.decision = 2;
        scene.paragraphs = [
          "Bulma's scanner draws a repeating line. Water strikes the trapped slab, falls back, then strikes again. Between surges there is a short quiet beat. \"I can call the moment,\" she says. \"Wait for it, and you can lift without fighting the hardest pull.\" She watches another cycle to be sure, then marks the bottom of the line.",
          "Goku notices a thin trickle crossing the rock instead of flowing around it. There may be a seam inside. A tiny ki pulse could test how the stone carries force and reveal a precise place to strike. That would teach him about the jam rather than the water's rhythm. He holds up one finger. \"Just enough to ask it a question.\"",
          "Bulma nods, then checks the downstream channel. Whichever method he chooses, she will watch the outlet while he concentrates. Learn the quiet beat for a controlled lift, or find the seam for a precise pulse. The gate will need a final action after the observation; neither test opens it by itself.",
        ];
        scene.choices = [
          option("timing", "learn the quiet beat", "follow the measured lull; helps lift without twisting"),
          option("probe", "probe the stone", "test with a tiny pulse; reveals where to aim"),
        ];
        break;
      case "prepared":
        scene.title = method === "timing" ? "between two surges" : "the stone answers";
        scene.decision = 2;
        scene.paragraphs = method === "timing" ? [
          "Goku rests his fingertips against the metal. Bulma watches the line on her scanner and counts each surge. On the third pass, he lifts one finger just before she speaks. The heavy vibration fades. They have found the same quiet beat. \"There it is,\" he says. \"It feels like waiting for someone to finish a punch.\"",
          approach === "hold"
            ? "The brace keeps the runners aligned while he tests that moment. He now has two reasons a careful lift should work: a steady frame and a lull in the pull. The reservoir still presses hard behind the stone, and watching the water has not shown him where the rock will split. A pulse would still be an uncertain push into a loaded jam."
            : "The relief ditch keeps taking water away. Its lower pressure and the learned lull solve different problems: the ditch can contain a pulse, while the quiet beat gives him a way to lift the unsupported gate without wrenching it. The runner is still bent. Timing gives him a careful way to work around that damage, not permission to ignore it.",
          "Goku repeats the motion once without moving the gate. Then he nods to Bulma. The next step will be a release, not another test.",
        ] : [
          "Goku cups a pinprick of light between his palms and lets it touch the stone. A dry click travels to the right; a dull knock answers from the left. He changes the angle and tries once more. This time a narrow line sheds a few grains of dust. The seam runs away from the gate, toward an empty pocket of the channel.",
          approach === "hold"
            ? "Bulma marks that line on her scanner. The brace still protects the frame for a lift. The new seam gives Goku a precise target if he chooses ki instead: the fragment can leave through the empty pocket without driving into the runners, even under the high water pressure. He has learned where to push, not when the water will ease."
            : "Bulma marks that line on her scanner. The relieved pressure makes a pulse easier to contain, and the seam now gives Goku an exact target. Both preparations favor that release. The unsupported gate would still be vulnerable to a lift, however. Testing the stone has not taught him when the water's pull will ease.",
          "\"A little turn makes a big difference,\" Goku says. He lets the light fade. The test has found a route through the rock without releasing the water yet.",
        ];
        scene.choices = [option("continue", "choose the release", "review what your preparations make possible")];
        break;
      case "release": {
        const liftSafe = approach === "hold" || method === "timing";
        const pulseSafe = approach === "drain" || method === "probe";
        scene.title = "strength with somewhere to go";
        scene.decision = 3;
        scene.paragraphs = [
          "Bulma brings the bell rope within reach and clears the last loose tool from the bank. Downstream, the carts have stopped on high ground. Nobody is standing in the outlet's path. Goku rolls his shoulders and studies the gap he wants to make: wide enough for the water to settle, narrow enough for the channel to carry it.",
          liftSafe
            ? `A lift has a safeguard: ${approach === "hold" ? "the beam will keep the runners aligned" : "the quiet beat will let Goku raise the unsupported gate without wrenching it"}. He can guide the slab out as the gate rises. That preserves the mechanism for the village to use again.`
            : "A lift has no safeguard here. The relief channel reduced pressure and the probe found the seam, but the runner is unsupported and the quiet beat is unknown. Goku can still hold the released water to a safe opening; the runner will bend and need repair.",
          pulseSafe
            ? `A pulse has a safeguard: ${method === "probe" ? "the seam gives the fragment a clear path away from the runners" : "the relieved pressure leaves room to contain the broken stone"}. A small, directed burst can free the gate without damaging its mechanism.`
            : "A pulse has no safeguard here. The beam protects a lift and the scanner taught the quiet beat, but pressure is high and the seam is unknown. Goku can catch the gate after the rock breaks; the sudden load will bend its runner and require repair.",
        ];
        scene.choices = [
          option("lift", "lift the gate", liftSafe ? "controlled lift; the gate remains usable" : "save the village; the bent runner will need repair"),
          option("pulse", "release a small ki pulse", pulseSafe ? "directed release; the gate remains usable" : "save the village; the bent runner will need repair"),
        ];
        break;
      }
      case "ending": {
        const intact = resolution === "lift"
          ? approach === "hold" || method === "timing"
          : approach === "drain" || method === "probe";
        scene.title = intact ? "a current, not a flood" : "safe banks, one repair";
        scene.decision = 3;
        scene.complete = true;
        const preparation = approach === "hold"
          ? "The beam you placed kept the gate aligned, while the reservoir's pressure remained high."
          : "The relief channel you cleared lowered the pressure, while the gate's runner remained unsupported.";
        const observation = method === "timing"
          ? "Learning Bulma's quiet beat gave Goku a controlled moment to lift; the stone's seam stayed unknown."
          : "The test pulse revealed the stone's seam, while the timing of the water's pull stayed unknown.";
        const action = resolution === "lift"
          ? intact
            ? `Goku raises the gate a hand's width, ${method === "timing" ? "moving in the quiet beat Bulma calls" : "letting the brace keep its runners straight"}. With his free hand he guides the loose slab into the empty channel pocket. Water pours through the small opening, then settles into an even current. He lowers the gate onto its stop. The mechanism holds.`
            : "Goku lifts, but the unsupported runner twists under the next surge. He immediately stops raising the gate and holds the opening at a hand's width. With his free hand he guides the slab away. The water settles safely. He wedges the gate onto its stop before letting go; the village is safe, but the bent runner will need repair."
          : intact
            ? `Goku draws his hands together and releases a short thread of ki. ${method === "probe" ? "It follows the seam he found, turning the loose fragment into the empty pocket." : "With the pressure relieved, the broken stone settles into the empty pocket instead of striking the runners."} He catches the freed gate and eases it up a hand's width. The channel takes the water smoothly. The mechanism holds.`
            : "Goku sends a short pulse into the jam. The rock breaks, but the high pressure drives a fragment against the runner. Metal bends. He catches the gate at once and holds it a hand's width open until the current settles, then wedges it safely onto its stop. No water reaches the houses, but the runner will need repair.";
        scene.paragraphs = [
          action,
          `${preparation} ${observation} ${intact ? "Those preparations gave your chosen release the safeguard it needed." : "Your final technique needed the safeguard you had not prepared. Goku's strength contained the release; it could not undo the bent metal."}`,
          intact
            ? "Bulma tests the handle twice before ringing the all-clear. The girl on the cart waves her flour sack until her father catches it. By the time Goku reaches their shop, the stove is warming again. He studies the first bowl like another interesting discovery. \"That was tricky. Think there's enough for a second one?\" Outside, the village keeper opens the gate himself. A quiet ribbon of water follows the channel."
            : "Bulma rings the all-clear after checking the wedge. She and the village keeper mark the damaged runner for replacement; the gate stays secured until their repair is done. Goku carries the spare metal down from the storehouse, then follows the girl and her rescued flour to the noodle shop. \"Let's get that fixed before lunch,\" he says. His stomach interrupts. \"Or during lunch.\" The houses are dry, and nobody has to sleep on the hill.",
        ];
        scene.summary = [
          approach === "hold" ? "braced frame · pressure stayed high" : "relieved pressure · frame stayed unsupported",
          method === "timing" ? "quiet beat learned · seam unknown" : "seam found · quiet beat unknown",
          `${resolution === "lift" ? "controlled lift" : "ki pulse"} · ${intact ? "gate preserved" : "runner needs repair"}`,
          "village safe · episode complete",
        ];
        break;
      }
      default:
        throw new Error("Unknown story scene");
    }
    return scene;
  }

  function choose(state, raw, expectedRevision = state.revision) {
    if (expectedRevision !== state.revision) return { state, accepted: false, message: "that choice has moved on; use the current options" };
    const scene = view(state);
    const command = normalize(raw);
    const selected = scene.choices.find(choice => choice.command === command);
    if (!selected) return { state, accepted: false, message: "choose one of the current commands" };
    const choices = { ...state.choices };
    let node;
    let response;
    if (state.node === "arrival") {
      node = "banks";
      response = ["Goku checks the gate and the relief channel. You can prepare one before tending the outlet."];
    } else if (state.node === "banks") {
      node = "aftermath";
      choices.approach = command;
      response = command === "hold"
        ? ["The beam braces the runners. The gate is aligned, but the water pressure stays high."]
        : ["The relief channel lowers the pressure. The gate's runner remains unsupported."];
    } else if (state.node === "aftermath") {
      node = "survey";
      response = ["The preparation is complete. Goku can now study the quiet beat or test the stone's seam."];
    } else if (state.node === "survey") {
      node = "prepared";
      choices.method = command;
      response = command === "timing"
        ? ["Goku learns the lull between surges. A lift can now follow the quiet beat."]
        : ["A tiny pulse finds the seam. Goku now has an exact target for a directed release."];
    } else if (state.node === "prepared") {
      node = "release";
      response = ["Bulma clears the outlet. Your preparations determine which release preserves the gate."];
    } else if (state.node === "release") {
      node = "ending";
      choices.resolution = command;
      const intact = command === "lift"
        ? choices.approach === "hold" || choices.method === "timing"
        : choices.approach === "drain" || choices.method === "probe";
      response = [intact
        ? "The release forms a steady current. The village stays dry and the gate remains usable."
        : "Goku contains the release and saves the village. The runner bends and needs repair."];
    }
    const next = freeze({ node, revision: state.revision + 1, choices,
      trail: [...state.trail, { title: scene.title, command, label: selected.label, response }] });
    return { state: next, accepted: true, message: "choice recorded" };
  }

  const api = Object.freeze({ create, view, choose, normalize });
  if (typeof window !== "undefined") window.PortfolioGokuStory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
