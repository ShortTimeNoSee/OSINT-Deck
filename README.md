# OSINT Deck

Welcome to OSINT Deck! This project aims to be a comprehensive, community-driven directory of Open Source Intelligence (OSINT) tools and resources, presented in an easy-to-navigate format.

## How to Contribute

There are two main ways to contribute:

1.  Directly editing `public/resources.json` (for developers or those comfortable with JSON).
2.  Suggesting new resources or reporting issues via the website interface.

This guide focuses on how to structure data if you are contributing directly to the `public/resources.json` file.

### Contributing to `public/resources.json`

The main data source for OSINT Deck is the `public/resources.json` file. This file defines the entire hierarchy of categories and resources.

#### Overall Structure

The `resources.json` file contains a **single root JSON object**. This object represents the top-most category ("OSINT Deck Central") and must have `type: "folder"`. It contains a `children` array that holds its sub-categories or resource items.

```json
{
  "name": "OSINT Deck Central",
  "type": "folder",
  "children": [
    {  },
    {  }
  ]
}
```

#### Node Object Structure

The `children` array of any folder (including the root object) contains an array of "Node Objects". A Node Object can represent either a **sub-folder** (which can have its own `children`) or a **resource item** (like a URL).

Each Node Object can have the following properties:

*   `name` (string, required): The display name of the folder or resource item (e.g., "Username Search Engines," "WhatsMyName"). This field is searchable.
*   `type` (string, required): Defines the nature of the node.
    *   `"folder"`: Indicates this node is a category/folder. It can (and usually will) have a `children` array for further nesting.
    *   `"url"`: Indicates this node is a specific resource with a link. It should have a `url` property.
*   `children` (array of Node Objects, optional): If `type` is `"folder"`, this array contains its nested sub-folders or resource items. Omit or use an empty array `[]` if the folder has no children yet.
*   `url` (string, required if `type` is `"url"`): The direct URL to the resource. Must be a valid HTTP/HTTPS URL.
*   `description` (string, optional): A brief description of the folder's content or the resource's purpose. This field is searchable.
*   `tags` (array of strings, optional): A list of relevant keywords or tags (e.g., `["image", "reverse search", "metadata"]`). Helps with searching and filtering. Up to 3 tags are displayed directly on a card but more may be added. Tags are searchable.
*   `status` (string, optional): Indicates the current status of the resource (e.g., `"active"`, `"verified"`, `"deprecated"`). Displayed as a badge.
    *   `"active"` gets a check-circle icon.
    *   `"deprecated"` gets a times-circle icon.
    *   Other values get an info-circle icon.
*   `cost` (string, optional): Describes the pricing model of the resource (e.g., `"free"`, `"paid"`, `"freemium"`). Displayed as a badge.
    *   `"free"` gets a check-circle icon.
    *   `"paid"` gets a dollar-sign icon.
    *   Other values get a credit-card icon.
*   `platform` (string, optional): Specifies the platform(s) the tool is designed for (e.g., `"web"`, `"api"`, `"windows"`). Displayed as a badge.
    *   `"web"` gets a globe icon.
    *   `"api"` gets a plug icon.
    *   Other values get a desktop icon.
*   `last_checked` (string, optional): An ISO 8601 formatted date string (e.g., `"2024-05-23T10:00:00Z"`) indicating when the resource was last verified. Displayed in a human-readable format.
*   `github` (string or array of strings, optional): GitHub repository URL(s) associated with the resource. Can be a single URL string or an array of URLs for multiple repositories. Displays as GitHub icon(s) that open the repository when clicked.

**Example Node Object (Folder):**

```json
{
  "name": "Image Analysis Tools",
  "type": "folder",
  "description": "Tools for analyzing and reverse searching images.",
  "children": [
    {
      "name": "TinEye Reverse Image Search",
      "type": "url",
      "url": "https://tineye.com/",
      "description": "Reverse image search engine.",
      "tags": ["image", "reverse search", "search engine"],
      "status": "verified",
      "cost": "freemium",
      "platform": "web",
      "last_checked": "2024-05-01T00:00:00Z"
    },
  ]
}
```

**Example Node Object (URL Item):**

```json
{
  "name": "ExifTool",
  "type": "url",
  "url": "https://exiftool.org/",
  "description": "Read, write and edit meta information in a wide variety of files.",
  "tags": ["metadata", "exif", "command-line", "tool"],
  "status": "active",
  "cost": "open-source",
  "platform": "CLI",
  "last_checked": "2024-04-15T00:00:00Z",
  "github": "https://github.com/exiftool/exiftool"
}
```

**Example with Multiple GitHub Repositories:**

```json
{
  "name": "Burp Suite",
  "type": "url",
  "url": "https://portswigger.net/burp/",
  "description": "Web application security testing platform.",
  "tags": ["web security", "penetration testing", "proxy"],
  "status": "active",
  "cost": "freemium",
  "platform": "desktop",
  "github": [
    "https://github.com/PortSwigger/burp-extensions-montoya-api",
    "https://github.com/PortSwigger/example-scanner-checks"
  ]
}
```

#### Full `resources.json` Example Snippet (Illustrating Nesting)

```json
{
  "name": "OSINT Deck Central",
  "type": "folder",
  "description": "The root collection of OSINT resources.",
  "children": [
    {
      "name": "Username & People Search",
      "type": "folder",
      "description": "Tools for finding information based on usernames or real names.",
      "children": [
        {
          "name": "Username Search Engines",
          "type": "folder",
          "children": [
            {
              "name": "WhatsMyName.app",
              "type": "url",
              "url": "https://whatsmyname.app/",
              "description": "Checks username availability across many sites.",
              "tags": ["username", "social media", "search engine"],
              "status": "verified",
              "cost": "free",
              "platform": "web"
            },
            {
              "name": "Namechk",
              "type": "url",
              "url": "https://namechk.com/",
              "description": "Check username and domain name availability.",
              "tags": ["username", "domain", "availability"],
              "cost": "free",
              "platform": "web"
            }
          ]
        },
        {
          "name": "People Search (General)",
          "type": "folder",
          "children": [
            {
              "name": "ThatsThem",
              "type": "url",
              "url": "https://thatsthem.com/",
              "description": "Public records search engine.",
              "tags": ["people search", "public records"],
              "cost": "freemium"
            }
          ]
        }
      ]
    },
    {
      "name": "Email Address Investigation",
      "type": "folder",
      "description": "Tools related to email addresses.",
      "children": [
        {
          "name": "Hunter.io",
          "type": "url",
          "url": "https://hunter.io/",
          "description": "Find email addresses in seconds.",
          "tags": ["email finder", "b2b", "lead generation"],
          "cost": "freemium",
          "platform": "web",
          "last_checked": "2024-05-20T00:00:00Z"
        }
      ]
    }
  ]
}
```

### Suggesting New Resources via the Website

If you're not comfortable editing JSON files, you can still contribute! OSINT Deck has a "Suggest a Resource" feature. Simply fill out the form on the website, and your suggestion will be reviewed.

### Guidelines for Contributions

*   Accuracy: Ensure URLs (if `type: "url"`) are correct and descriptions are accurate.
*   Relevance: Only submit tools and resources directly relevant to Open Source Intelligence.
*   Nesting: Place new items or folders within the most appropriate parent category. If a new category is needed, create a new folder node.
*   Conciseness: Keep descriptions informative but brief.
*   Tags: Use relevant and common tags to improve discoverability.
*   Check for duplicates: Before adding a new resource, please browse or search the site to see if it (or something very similar) already exists.
*   `last_checked` date: If you verify a tool is working, consider adding or updating its `last_checked` date using the YYYY-MM-DDTHH:MM:SSZ format, but only if you make other changes as well.

Thank you for helping make OSINT Deck a valuable resource for the community!
