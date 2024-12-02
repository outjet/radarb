import os

# List of important file paths
file_paths = [
    "/Users/outjet/Sites/radarb/functions/index.js",
    "/Users/outjet/Sites/radarb/package.json",
    "/Users/outjet/Sites/radarb/public/index.html",
    "/Users/outjet/Sites/radarb/public/styles/style.css",
    "/Users/outjet/Sites/radarb/public/scripts/app1597.js",
    "/Users/outjet/Sites/radarb/config.js",
    "/Users/outjet/Sites/radarb/firebase.json",
]

# Output file
output_file = "project_files_with_contents.txt"

def write_files_with_contents(paths, output):
    with open(output, "w") as out_file:
        for path in paths:
            try:
                # Write the file path
                out_file.write(f"File Path: {path}\n")
                out_file.write("-" * 80 + "\n")
                
                # Write the file contents
                if os.path.exists(path):
                    with open(path, "r") as f:
                        out_file.write(f.read())
                else:
                    out_file.write("File not found or cannot be accessed.\n")
                
                out_file.write("\n" + "=" * 80 + "\n\n")
            except Exception as e:
                out_file.write(f"Error reading file {path}: {e}\n")
                out_file.write("\n" + "=" * 80 + "\n\n")

# Generate the output file
write_files_with_contents(file_paths, output_file)

print(f"File list and contents written to {output_file}")
