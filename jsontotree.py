# error handling / console output formatting were automated with AI assistance.

import json

def print_folder_tree(node, prefix="", is_last_child=False):
    if node.get("type") == "folder":
        print(f"{prefix}{'└── ' if is_last_child else '├── '}{node['name']}")

        children_prefix = f"{prefix}{'    ' if is_last_child else '│   '}"

        if "children" in node and node["children"]:
            folder_children = [child for child in node["children"] if child.get("type") == "folder"]
            
            num_folder_children = len(folder_children)
            for i, child_node in enumerate(folder_children):
                is_last = (i == num_folder_children - 1)
                print_folder_tree(child_node, children_prefix, is_last)

def main():
    filename = "public/resources.json"
    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: '{filename}' not found in the current directory.")
        print("Please ensure the file exists and the script is run from the same directory.")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{filename}'.")
        print("Please ensure the file contains valid JSON.")
        return

    if data.get("type") == "folder":
        print(data["name"])

        if "children" in data and data["children"]:
            root_folder_children = [child for child in data["children"] if child.get("type") == "folder"]
            
            num_root_folder_children = len(root_folder_children)
            for i, child_node in enumerate(root_folder_children):
                is_last = (i == num_root_folder_children - 1)
                print_folder_tree(child_node, "", is_last)
    else:
        print(f"The root element in '{filename}' is not a folder or is missing the 'type' key.")

if __name__ == "__main__":
    main()