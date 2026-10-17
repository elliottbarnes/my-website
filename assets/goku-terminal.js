// Terminal presentation of the existing episode. Reading and parsing never change story state.
(() => {
  "use strict";
  const story = typeof module !== "undefined" && module.exports
    ? require("./goku-story.js")
    : window.PortfolioGokuStory;

  const verbs = Object.freeze({
    begin: "begin", hold: "brace gate", drain: "clear channel", continue: "continue",
    timing: "wait", probe: "probe rock", lift: "lift gate", pulse: "ki pulse",
  });
  const labels = Object.freeze({
    begin: "inspect the spillway", hold: "brace the gate", drain: "clear the relief channel",
    continue: "continue", timing: "learn the quiet beat", probe: "find the stone's seam",
    lift: "lift the gate", pulse: "release a small ki pulse",
  });
  const utilities = Object.freeze({ help: "help", "?": "help", exit: "exit", quit: "exit", bye: "exit",
    restart: "restart", confirm: "confirm", cancel: "cancel", clear: "clear" });

  function conditions(state) {
    const { approach, method, resolution } = state.choices;
    const liftSafe = approach === "hold" || method === "timing";
    const pulseSafe = approach === "drain" || method === "probe";
    return { approach, method, resolution, liftSafe, pulseSafe,
      intact: resolution === "lift" ? liftSafe : pulseSafe, complete: state.node === "ending" };
  }

  function facts(state) {
    const { approach, method, resolution, intact, complete } = conditions(state);
    return [
      complete ? `gate: ${intact ? "usable" : "secured; runner needs repair"}` : "gate: jammed",
      approach === "hold" ? "preparation: braced frame; high pressure"
        : approach === "drain" ? "preparation: relieved pressure; unsupported frame" : "preparation: none",
      method === "timing" ? "learned: quiet beat; seam unknown"
        : method === "probe" ? "learned: seam; quiet beat unknown" : "learned: neither quiet beat nor seam",
      `release: ${resolution ? verbs[resolution] : "not chosen"}`,
      complete ? "village: safe" : "village: waiting on high ground",
    ];
  }

  function art(state) {
    const { approach, method, complete, intact } = conditions(state);
    const rows = [
      "   \\  | /       reservoir",
      "  --\\ |/--    ~~~~~~~~~~~~~",
      "   /\\/^\\/\\    ~~~~|#|~~~~",
      "   \\ o o /         |#|",
      "    \\_-_/      ____|#|____",
      "   /|===|\\          [@]",
      "  /_|___|_\\          |",
      "    /   \\       ___/   \\___",
      "     goku          village",
    ];
    if (approach === "hold") rows[4] = "    \\_-_/      ___/|#|\\___";
    if (approach === "drain") {
      rows[2] = "   /\\/^\\/\\    ~~~ |#|  ->~";
      rows[6] = "  /_|___|_\\          |    ~";
    }
    if (method === "timing") rows[1] = "  --\\ |/--     _/\\__   _/\\__";
    if (method === "probe") rows[5] = "   /|===|\\          [/]";
    if (state.node === "survey") rows[5] = "   /|===|\\          [@]?";
    if (complete) {
      rows[1] = "  --\\ |/--     ~~~~~~~~~~~~";
      rows[2] = "   /\\/^\\/\\        | |";
      rows[3] = intact ? "   \\ o o /         | |" : "   \\ o o /         |/|";
      rows[4] = "    \\_-_/      ____| |____";
      rows[5] = "   /|===|\\          ~~~";
      rows[6] = "  /_|___|_\\          ~";
      rows[7] = "    /   \\       ___/ ~ \\___";
      rows[8] = intact ? "     goku       village: safe" : "     goku       repair needed";
    }
    return rows.join("\n");
  }

  function screen(state) {
    const scene = story.view(state);
    const { approach, method, resolution, liftSafe, pulseSafe, intact } = conditions(state);
    let description;
    switch (state.node) {
      case "arrival":
        description = [
          "You are Goku. A stone jams the reservoir gate. Below, a girl guards the flour from her family's noodle shop while everyone moves uphill.",
          "Bulma's scanner rattles against the rail. \"Break the gate and you flood their kitchens. We need a small, steady release.\" Goku tests the stone with one finger. \"Okay. Let's find where it wants to move.\"",
        ];
        break;
      case "banks":
        description = [
          "The gate's runner leans sideways. A fallen beam could brace it for a lift, but water pressure would stay high. The relief channel is choked with branches: clearing it lowers pressure for a ki pulse, but leaves the frame unsupported.",
          "Bulma points to the outlet. \"Once you start, you need to tend that opening. Prepare one approach first.\" Goku checks the beam. \"Strong enough. Now, where do we need it?\"",
        ];
        break;
      case "aftermath":
        description = approach === "hold" ? [
          "Goku seats the beam gently. The frame stops twisting; the gate remains jammed. Water still pounds behind it.",
          "\"The brace protects a lift,\" Bulma says. \"A pulse still needs a precise target under this pressure.\" Goku watches a drop dance on the beam. \"Even a little push matters.\" The family waits uphill while you inspect the jam.",
        ] : [
          "Goku clears the branches. Water follows the relief channel around the houses, and the reservoir mark emerges. The main gate remains jammed and unsupported.",
          "\"Less pressure makes a pulse easier to contain,\" Bulma says. \"A lift still needs careful timing.\" Goku studies the bent runner. \"Then let's learn when it stops pulling.\" The family stays uphill.",
        ];
        break;
      case "survey":
        description = [
          "Bulma's scanner repeats a pattern: surge, retreat, surge. \"Wait with me and learn the quiet beat. You can lift without fighting the hardest pull.\"",
          "Goku notices a trickle crossing the trapped rock. A tiny test pulse could find its seam instead, giving a precise target for ki. \"Just enough to ask it a question.\" Neither observation opens the gate. Choose what to learn before the release.",
        ];
        break;
      case "prepared": {
        const preparation = approach === "hold"
          ? "The brace holds the frame straight; pressure remains high."
          : "The relief channel lowers pressure; the frame remains unsupported.";
        const learned = method === "timing"
          ? "Goku feels the vibration fade just before Bulma calls it. \"Like waiting for a punch to finish.\" You know the quiet beat for a lift; the stone's seam is still unknown."
          : "A tiny pulse answers with a dry click. The seam leads toward an empty pocket. \"A little turn makes a big difference.\" You know where to aim ki; the quiet beat is still unknown.";
        description = [preparation, learned, "Bulma clears the outlet. The next move releases the water."];
        break;
      }
      case "release":
        description = [
          "Goku studies a hand's-width opening. \"That much water, and no more.\" Bulma checks that everyone is clear.",
          liftSafe
            ? `lift gate: ${approach === "hold" ? "the brace keeps the runners aligned" : "the learned quiet beat protects the unsupported runner"}. The mechanism will stay usable.`
            : "lift gate: the frame is unsupported and the quiet beat unknown. Goku can contain the water, but the runner will bend.",
          pulseSafe
            ? `ki pulse: ${method === "probe" ? "the known seam guides the fragment away" : "relieved pressure lets Goku contain the broken stone"}. The mechanism will stay usable.`
            : "ki pulse: pressure is high and the seam unknown. Goku can catch the gate, but the runner will bend.",
        ];
        break;
      case "ending": {
        const preparation = approach === "hold" ? "You braced the frame, leaving high pressure." : "You relieved pressure, leaving the frame unsupported.";
        const learned = method === "timing" ? "You learned the quiet beat, not the seam." : "You found the seam, not the quiet beat.";
        const result = resolution === "lift"
          ? intact
            ? `Goku lifts; ${approach === "hold" ? "the brace keeps the gate aligned" : "the quiet beat protects the runner"}. The gate remains usable.`
            : "Goku lifts without support or the quiet beat. The runner bends; he contains the water and secures the gate for repair."
          : intact
            ? `Goku releases ki; ${method === "probe" ? "the seam directs the fragment away" : "relieved pressure contains the broken stone"}. The gate remains usable.`
            : "Goku releases ki under high pressure without knowing the seam. The runner bends; he catches the gate and secures it for repair.";
        description = [preparation, learned, result,
          "Bulma rings the all-clear. The family returns to a dry noodle shop. Goku grins. \"Now, about that lunch...\" Village saved."];
        break;
      }
    }
    return {
      location: state.node === "arrival" ? "mountain spillway" : state.node === "ending" ? "village" : "spillway bank",
      title: scene.title, art: art(state), description,
      actions: scene.choices.map(choice => ({ command: verbs[choice.command], label: labels[choice.command] })),
      facts: facts(state),
    };
  }

  function inspect(state, target) {
    const { approach, method, complete, intact } = conditions(state);
    if (target === "gate") {
      if (complete) return [intact
        ? "The gate moves on its runners again. The keeper can regulate a steady current; the village is safe."
        : "Goku has wedged the gate at a safe opening. The bent runner needs replacement before the keeper can move it again."];
      return [approach === "hold"
        ? "The beam braces the runners for a lift. The gate is still jammed and the water pressure is high."
        : approach === "drain"
          ? `Pressure has dropped, but the gate's runner is unsupported. ${method === "timing" ? "The quiet beat you learned lets Goku lift without twisting it." : method === "probe" ? "Without the quiet beat, a lift will bend the runner." : "A lift needs the quiet beat to avoid twisting it."}`
          : "A rock jams the gate. Its runner leans out of line. The fallen beam could brace it for a lift; pressure would remain high."];
    }
    if (target === "rock") {
      if (complete) return ["The loose stone rests in the empty channel pocket. It no longer jams the gate."];
      return [method === "probe"
        ? "Your test revealed a seam toward the empty pocket. A small ki pulse along it can free the gate without driving stone into the runners."
        : method === "timing"
          ? "You studied the water's rhythm instead of probing the slab. Its seam is unknown; a pulse needs relieved pressure to preserve the gate."
          : "A slab is wedged beneath the gate. Its seam is unknown. A tiny test pulse could reveal where force will travel."];
    }
    return [complete
      ? "The outlet carries a steady current. The houses and noodle shop stay dry."
      : approach === "drain"
        ? "Water follows the cleared relief ditch around the village. Pressure is lower, but the main gate is still blocked."
        : approach === "hold"
          ? "The relief ditch is still blocked. You prepared the gate's brace instead, so the pressure remains high."
          : "Branches and gravel block the relief ditch. Clearing it lowers pressure for a pulse, but would leave the gate's runner unsupported."];
  }

  function advice(state) {
    const { approach, method, liftSafe, pulseSafe, complete, intact } = conditions(state);
    if (complete) return [intact
      ? 'Bulma: "The keeper can use the gate again. Nice control. Let\'s get those people home."'
      : 'Bulma: "The village is safe. Leave the gate secured while we replace the runner. You can carry the spare."'];
    if (state.node === "arrival") return ['Bulma: "One small opening. Smashing the whole gate would send the reservoir through the village."'];
    if (state.node === "banks") return ['Bulma: "Brace the frame for a lift, or drain pressure for a pulse. Prepare one, then attend the outlet."'];
    if (!method) return [`Bulma: "${approach === "hold" ? "The brace protects a lift, but pressure is high." : "The relieved pressure helps a pulse, but the frame is unsupported."} Learn the quiet beat for lifting, or probe the seam for ki."`];
    return [`Bulma: "${liftSafe ? "Your lift has a safeguard." : "A lift will bend the unsupported runner without the quiet beat."} ${pulseSafe ? "Your pulse has a safeguard." : "A pulse will bend the runner under high pressure without the seam."} Either way, keep the opening small."`];
  }

  function map(state) {
    const { approach, complete, intact } = conditions(state);
    return [
      "      [mountain reservoir]",
      "               |",
      complete ? "      [open gate]" : "      [spillway] <- you",
      "         |         +---+",
      `         |     [${approach === "drain" ? "relief flow" : "blocked ditch"}]`,
      "         v           |",
      `      [village]    ${approach === "drain" ? "safe bypass" : "dry channel"}`,
      ...(complete ? ["          ^ you"] : []),
      complete ? `      safe; ${intact ? "gate usable" : "repair needed"}` : "      families uphill",
    ];
  }

  function parse(state, raw) {
    if (typeof raw !== "string" || raw.length > 64) return {
      kind: "invalid", lines: ["use a command of 1 to 64 characters; type help for commands"], echo: "",
    };
    const echo = story.normalize(raw).replace(/\s+/g, " ");
    if (!echo) return { kind: "invalid", lines: ["type a command; look describes your surroundings"], echo };
    if (Object.hasOwn(utilities, echo)) return { kind: "utility", command: utilities[echo], echo };
    let lines;
    if (echo === "look" || echo === "l") lines = screen(state).description;
    else if (echo === "look gate" || echo === "look rock" || echo === "look channel") lines = inspect(state, echo.slice(5));
    else if (echo === "talk" || echo === "talk bulma") lines = advice(state);
    else if (echo === "status") lines = [`goal: ${story.view(state).objective}`, ...facts(state)];
    else if (echo === "map") lines = [map(state).join("\n"), state.node === "ending" ? "you: village; family back home" : "you: spillway; families uphill"];
    else if (echo === "read") lines = [...story.view(state).paragraphs];
    if (lines) return { kind: "read", lines, echo };
    const choices = story.view(state).choices;
    const action = choices.find(choice => choice.command === echo || verbs[choice.command] === echo);
    if (action) return { kind: "action", command: action.command, echo };
    const available = choices.map(choice => verbs[choice.command]);
    return { kind: "invalid", echo, lines: [available.length
      ? `try ${available.join(" or ")}; look, talk bulma, or help can guide you`
      : "the episode is complete; try look, read, restart, or exit"] };
  }

  const api = Object.freeze({ screen, parse });
  if (typeof window !== "undefined") window.PortfolioGokuTerminal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
