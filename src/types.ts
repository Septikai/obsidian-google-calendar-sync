declare module "obsidian" {
	interface App {
		dom: {
			appContainerEl: HTMLElement;
		},
		plugins: {
			plugins: {
				"obsidian-full-calendar": {

				}
			};
		};
	}
}

export {};
