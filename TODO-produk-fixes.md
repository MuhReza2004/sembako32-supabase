# TODO: Fix Product Edit and Delete Features

## Issues Identified

1. **Missing Stock Field in Edit Dialog**: The edit dialog doesn't include a field for updating stock, but the form data type requires it.
2. **Delete Button State Management**: The delete button's loading state isn't properly reset after operations.
3. **Form Validation**: The edit form might not handle stock updates correctly.

## Fixes Needed

- [x] Add stock input field to DialogEditProduk.tsx with proper validation
- [x] Fix delete button state management in TabelProduk.tsx
- [x] Ensure proper form validation and data handling for stock field
- [x] Test the edit and delete functionality

## Implementation Steps

1. Update DialogEditProduk.tsx to include stock field
2. Update TabelProduk.tsx to properly manage delete button state
3. Test the functionality
