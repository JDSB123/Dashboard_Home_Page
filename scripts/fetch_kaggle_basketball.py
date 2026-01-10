import kagglehub
import os
import shutil

# Download latest version
# This will download to the local cache directory for kagglehub
path = kagglehub.dataset_download("wyattowalsh/basketball")

print("Dataset downloaded to:", path)

# List files
print("\nFiles in dataset:")
for root, dirs, files in os.walk(path):
    for file in files:
        print(os.path.join(root, file))
