import kagglehub
import os

# Download latest version of the requested dataset
dataset_handle = "eoinamoore/historical-nba-data-and-player-box-scores"
print(f"Downloading {dataset_handle}...")

path = kagglehub.dataset_download(dataset_handle)

print("Dataset downloaded to:", path)

# List files
print("\nFiles in dataset:")
for root, dirs, files in os.walk(path):
    for file in files:
        print(os.path.join(root, file))
