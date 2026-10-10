import {
	Action,
	ActionPanel,
	closeMainWindow,
	Icon,
	Keyboard,
	List,
	PopToRootType,
	runInTerminal,
	showToast,
	Toast,
} from "@vicinae/api";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// One link per line: [name] <url> [container|-] [tab|window|app]
//   name: optional, can have spaces; the words before the first one that looks like a URL (has "." or "://")
//   container: a Brave container's name, "temp" for a new temporary container, "-" for none (default)
//   tab: a tab in the current window (default), window: a new window, app: a borderless web app window
const CONFIG = join(
	process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
	"archype",
	"links",
);
const MODES = ["tab", "window", "app"] as const;
const TEMPORARY = "temp";

type Mode = (typeof MODES)[number];
type Link = { name?: string; url: URL; container?: string; mode: Mode };
type Problem = { line: number; text: string; reason: string };

function parseConfig(text: string) {
	const links: Link[] = [];
	const problems: Problem[] = [];

	text.split("\n").forEach((raw, i) => {
		const line = raw.trim();
		if (!line || line.startsWith("#")) return;

		const fields = line.split(/\s+/);
		const start = fields.findIndex((field) => field.includes(".") || field.includes("://"));
		const problem = (reason: string) => problems.push({ line: i + 1, text: line, reason });
		if (start === -1) return problem("no URL");

		const name = fields.slice(0, start).join(" ") || undefined;
		const [address, container = "-", mode = "tab", ...rest] = fields.slice(start);

		let url: URL;
		try {
			url = new URL(/^[a-z]+:\/\//i.test(address) ? address : `https://${address}`);
		} catch {
			return problem(`not a URL: ${address}`);
		}
		if (!MODES.includes(mode as Mode)) return problem(`unknown mode "${mode}", use tab, window or app`);
		if (rest.length) return problem("too many fields; container names can't have spaces");

		links.push({ name, url, container: container === "-" ? undefined : container, mode: mode as Mode });
	});

	return { links, problems };
}

function braveArgs({ url, container, mode }: Link) {
	const args =
		container === TEMPORARY ? ["--temporary-container"] : container ? [`--container=${container}`] : [];
	if (mode === "app") return [...args, `--app=${url}`];
	if (mode === "window") return [...args, "--new-window", url.toString()];
	return [...args, url.toString()];
}

async function launch(args: string[]) {
	// uwsm-app starts Brave in its own systemd scope, like the rest of the desktop's apps
	const [command, ...rest] = existsSync("/usr/bin/uwsm-app")
		? ["uwsm-app", "--", "brave", ...args]
		: ["brave", ...args];

	try {
		spawn(command, rest, { detached: true, stdio: "ignore" }).unref();
		await closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate });
	} catch (error) {
		await showToast({ style: Toast.Style.Failure, title: "Couldn't start Brave", message: String(error) });
	}
}

async function editConfig() {
	await runInTerminal([process.env.EDITOR || "nvim", CONFIG]);
	await closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate });
}

const EditAction = () => (
	<Action title="Edit Links" icon={Icon.Pencil} shortcut={Keyboard.Shortcut.Common.Edit} onAction={editConfig} />
);

function address(url: URL) {
	return url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, "");
}

export default function Links() {
	let config = "";
	let missing = false;
	try {
		config = readFileSync(CONFIG, "utf8");
	} catch {
		missing = true;
	}

	const { links, problems } = parseConfig(config);
	const containers = [...new Set(links.map((link) => link.container))];

	return (
		<List searchBarPlaceholder="Open in Brave...">
			<List.EmptyView
				title="No links"
				description={`Add some to ${CONFIG}`}
				icon={Icon.Globe01}
				actions={
					<ActionPanel>
						<EditAction />
					</ActionPanel>
				}
			/>

			{containers.map((container) => (
				<List.Section key={container ?? "-"} title={container === TEMPORARY ? "Temporary container" : (container ?? "Links")}>
					{links
						.filter((link) => link.container === container)
						.map((link, i) => (
							<List.Item
								key={`${link.url}-${i}`}
								title={link.name ?? address(link.url)}
								subtitle={link.name ? address(link.url) : undefined}
								keywords={[link.url.hostname, container ?? ""]}
								icon={{ source: `icon://favicon/${link.url.hostname}`, fallback: Icon.Globe01 }}
								accessories={[
									...(link.mode === "tab" ? [] : [{ tag: link.mode }]),
									...(container ? [{ tag: container }] : []),
								]}
								actions={
									<ActionPanel>
										<Action title="Open" icon={Icon.Globe01} onAction={() => launch(braveArgs(link))} />
										<Action.CopyToClipboard title="Copy URL" content={link.url.toString()} />
										<EditAction />
									</ActionPanel>
								}
							/>
						))}
				</List.Section>
			))}

			{(missing || problems.length > 0) && (
				<List.Section title={`Problems in ${CONFIG}`}>
					{missing && (
						<List.Item
							title="No links file yet"
							subtitle={CONFIG}
							icon={Icon.Warning}
							actions={
								<ActionPanel>
									<EditAction />
								</ActionPanel>
							}
						/>
					)}
					{problems.map((p) => (
						<List.Item
							key={p.line}
							title={`Line ${p.line}: ${p.reason}`}
							subtitle={p.text}
							icon={Icon.Warning}
							actions={
								<ActionPanel>
									<EditAction />
								</ActionPanel>
							}
						/>
					))}
				</List.Section>
			)}
		</List>
	);
}
